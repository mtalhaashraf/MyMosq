<script>
  import firebase, { auth, functions } from "$lib/firebase.js";
  import { onMount } from "svelte";
  import { currentUser } from "$lib/store/currentUser.js";
  import { equals } from "ramda";
  import { _ } from "svelte-i18n";
  import { Alert, Form, Input, Button } from "sveltestrap";
  import Fa from "svelte-fa";
  import { faRedo, faTrash } from "@fortawesome/free-solid-svg-icons";
  import * as XLSX from "xlsx";

  let loading = false;
  let admins = [];
  let message = {};
  let mosques = [];
  let unions = [];

  $: console.log({ admins, mosques, unions });

  const getCacheCollection = async (name) => {
    return await firebase
      .firestore()
      .collection("cache")
      .doc(name)
      .get()
      .then((e) => e.data())
      .then((docs) => {
        return Object.entries(docs).map(([k, v]) => ({ id: k, ...v }));
      });
  };

  function changeMosque(e, adminId) {
    const { value } = e.target;
    if (unions.map((e) => e.id).includes(value)) {
      const newAdmins = admins.map((admin) => {
        if (admin.userId === adminId)
          return {
            ...admin,
            // mosqueId: value,
            // id: value,
            // type: "union",
            org: {
              id: value,
              type: "union",
            },
            changed: true,
          };
        return admin;
      });

      admins = newAdmins;
    } else if (mosques.map((e) => e.id).includes(value)) {
      const newAdmins = admins.map((admin) => {
        if (admin.userId === adminId)
          return {
            ...admin,
            mosqueId: value,
            // id: value,
            // type: "mosque",
            org: {
              id: value,
              type: "mosque",
            },
            changed: true,
          };
        return admin;
      });

      admins = newAdmins;
    } else {
      const newAdmins = admins.map((admin) => {
        if (admin.userId === adminId)
          return {
            ...admin,
            mosqueId: "",
            org: {
              id: "",
              type: "",
            },
            changed: true,
          };
        return admin;
      });

      admins = newAdmins;
    }
  }

  function deleteAdmin(adminId) {
    const confirmation = window.confirm($_("adminDeleteConfirmation"));
    if (confirmation === true) {
      const deleteUser = functions.httpsCallable("deleteUser");

      admins = admins.filter((admin) => admin.userId !== adminId);

      deleteUser({ uid: adminId });
    }
  }

  function handleSubmit(e) {
    loading = true;

    const adminsToChange = admins.filter((admin) => {
      if (admin.changed === true && !admin.shouldDelete) {
        return true;
      } else return false;
    });
    let changePromises = [];
    if (adminsToChange.length > 0) {
      changePromises = adminsToChange.map((admin) =>
        firebase
          .firestore()
          .collection("users")
          .doc(admin.userId)
          .update({
            mosqueId: admin.org.type === "union" ? null : admin.mosqueId,
            org: { id: admin.org.id, type: admin.org.type },
          })
      );
    }
    const allPromises = Promise.all([...changePromises]);
    allPromises
      .then(() => {
        loading = false;
        message = {
          variant: "success",
          text: $_("saveSuccessMessage"),
        };
        setTimeout(() => {
          message = {};
        }, 5000);
      })
      .catch((err) => {
        console.error(err);
        loading = false;
      });
  }

  function handlePasswordReset(email) {
    auth
      .sendPasswordResetEmail(email)
      .then(() => {
        message = {
          variant: "success",
          text: $_("resetPasswordSuccess"),
        };
      })
      .catch((error) => {
        console.error(error);
        message = {
          variant: "danger",
          text: $_("resetPasswordError"),
        };
      });
  }

  onMount(getUnions);
  function getUnions() {
    return firebase
      .firestore()
      .collection("Unions")
      .onSnapshot((snapshot) => {
        const arr = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
          };
        });

        unions = Object.values(arr[0]);
      });
  }

  $: if ($currentUser.user) getUsers();
  function getUsers() {
    getCacheCollection("users")
      .then((docs) => docs.filter((e) => equals(e.role, "admin")))
      .then((docs) => docs.map(({ id, ...rest }) => ({ userId: id, ...rest })))
      .then((cacheUsers) => (admins = cacheUsers));
  }

  const getCountryCacheMosques = async (code) => {
    const result = await firebase
      .firestore()
      .collection("cache")
      .doc("mosques")
      .collection(code)
      .get()
      .then((snap) => snap.docs.map((doc) => doc.data()));

    const mosques = [];

    for (const shard of result) {
      Object.entries(shard).forEach(([id, mosque]) => {
        mosques.push({ ...mosque, id });
      });
    }

    mosques.sort((a, b) => a.id - b.id);

    return mosques;
  };

  $: if ($currentUser.selectedCountry && $currentUser.settings.countries) getMosques();

  async function getMosques() {
    if ($currentUser.selectedCountry === "all") {
      mosques = (
        await Promise.all($currentUser.settings.countries.map(getCountryCacheMosques))
      ).flat();
    } else {
      mosques = await getCountryCacheMosques($currentUser.selectedCountry);
    }
  }

  $: filteredAdmins = admins
    .filter((admin) => {
      if ($currentUser.selectedCountry === "") return false;
      if ($currentUser.selectedCountry === "all") return true;

      if (admin.org.id === "") {
        return true;
      } else if (admin.org.type === "mosque") {
        const mosque = mosques.find((mosque) => mosque.id === admin.org.id);
        return mosque?.Country === $currentUser.selectedCountry;
      } else if (admin.org.type === "union") {
        const union = unions.find((union) => union.id === admin.org.id);
        return union?.Country === $currentUser.selectedCountry;
      }

      return false;
    })
    .sort((a, b) => isGreater(a.email, b.email));

  function isGreater(x, y) {
    return x[0].toLowerCase() > y[0].toLowerCase() ? 1 : -1;
  }

  function handleExport() {
    const exportData = filteredAdmins.map((values) => {
      let orgName;
      if (values.org && values.org.type === "mosque") {
        const mosque = mosques.find((mosque) => mosque.id === values.org.id);
        if (!mosque) orgName = "";
        else orgName = `${mosque.Kanton} ${mosque.Ort} - ${mosque.Name}`;
      } else if (values.org && values.org.type === "union") {
        const union = unions.find((union) => union.id === values.org.id);
        if (!union) orgName = "";
        else orgName = `${union.Ort} ${union.Shortname}`;
      } else {
        orgName = "No Union";
      }

      return [values.userId, values.role, values.email, values.org?.id, values.org?.type, orgName];
    });
    exportData.unshift(["userId", "role", "email", "org.id", "org.type", "Org Name"]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Admins");
    XLSX.writeFileXLSX(wb, "admins.xlsx");
  }

  function handleCountryChange(e) {
    $currentUser.selectedCountry = e.target.dataset.value;
  }

  $: filteredUnions = unions
    .sort((x, y) => {
      if (!x.Country || !y.Country) return true;
      if (x.Country[0] === y.Country[0]) {
        return isGreater(x.Shortname, y.Shortname);
      } else {
        return isGreater(x.Country, y.Country);
      }
    })
    .filter((union) => {
      if ($currentUser.selectedCountry === "all") return true;
      return union.Country === $currentUser.selectedCountry;
    });

  $: filteredMosques = mosques.filter((mosque) => {
    if ($currentUser.selectedCountry === "all") return true;
    return mosque.Country === $currentUser.selectedCountry;
  });
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <h1>{$_("admins")}</h1>

    <div class="custom-menu__item" style="display: flex; align-items: center; gap: 1rem;">
      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {$_($currentUser.selectedCountry)}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          <a
            class="dropdown-item"
            on:click|preventDefault={handleCountryChange}
            href="#"
            data-value={"all"}
          >
            {"all"}
          </a>
          {#each $currentUser.settings?.countries || [] as country}
            <a
              class="dropdown-item"
              on:click|preventDefault={handleCountryChange}
              href="#"
              data-value={country}
            >
              {$_(country)}
            </a>
          {/each}
        </div>
      </li>

      <li class="custom-menu__item" style="display: flex; gap: 0.4rem;">
        <button class="btn btn-primary" on:click={handleExport}>
          {$_("export")}
        </button>

        <a href="/admins/add">
          <button class="btn btn-primary">
            {$_("addNew")}
          </button>
        </a>
      </li>
    </div>
  </ul>
</div>

{#if message.text}
  <Alert color={message.variant}>
    <div class="alert-content">
      <p>{message.text}</p>
    </div>
  </Alert>
{/if}

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr>
        <th>{$_("email")}</th>
        <th>{$_("mosque")}</th>
        <th>{$_("actions")}</th>
      </tr>
    </thead>
    <tbody>
      {#each filteredAdmins as admin}
        <tr>
          <td class="email">{admin.email || `${admin.org.id} - undefined`}</td>
          <td>
            <Form>
              <Input
                type="select"
                on:change={(e) => changeMosque(e, admin.userId)}
                value={admin.org.id}
              >
                <option value="">No Org</option>

                {#each filteredUnions as union}
                  <option value={union.id} selected={admin.org.id === union.id}>
                    {`${union.Country} - ${union.Shortname} - ${union.Fullname}`}
                  </option>
                {/each}

                <option value="">{$_("noMosque")}</option>

                {#each filteredMosques as mosque}
                  <option value={mosque.id} selected={admin.org.id === mosque.id}>
                    {`${mosque.id} - ${mosque.Ort} ${mosque.Kanton} - ${mosque.Name}`}
                  </option>
                {/each}
              </Input>
            </Form>
          </td>
          <td style="display: flex; gap: 1rem;">
            <Button
              disabled={loading}
              class="btn btn-icon btn-squared btn-primary"
              on:click={() => handlePasswordReset(admin.email)}
            >
              <Fa class="events-action-button" icon={faRedo} color="white" />
            </Button>
            <Button
              disabled={loading}
              class="btn btn-icon btn-squared btn-danger"
              on:click={() => deleteAdmin(admin.userId)}
            >
              <Fa class="events-action-button" icon={faTrash} color="white" />
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if admins.length}
  <Button class="btn btn-primary" on:click={handleSubmit} disabled={loading}>
    {loading ? $_("saving") : $_("confirChanges")}
  </Button>
{/if}
