<script>
  import { currentUser } from "$lib/store/currentUser.js";
  import { Loader } from "@googlemaps/js-api-loader";
  import { onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import { isMosq, isSuperAdmin, isUnionAdmin } from "@utility/helpers.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import firebase from "$lib/firebase.js";
  import { Form, FormGroup, Input, Label, TabContent, TabPane, Button, Spinner } from "sveltestrap";
  import Compressor from "compressorjs";
  import { v4 as uuidv4 } from "uuid";
  import { faTrash } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";

  const loader = new Loader({
    apiKey: "AIzaSyBFi3QWRprPsmdZGGLudVbnpwi2QAisgRI",
    version: "weekly",
    libraries: ["places"],
  });

  const emptyMosqueTemplate = {
    subsAndroid: 0,
    Website: "",
    numPosts: 0,
    OffiziellerName: "",
    membership: [],
    coords: {
      lat: 0,
      lng: 0,
    },
    postsEnabledWeb: true,
    YouTube: "",
    Country: "ch",
    postsEnabledApp: true,
    Facebook: "",
    IBAN: "",
    Ort: "",
    logoUrl: "",
    Name: "",
    Email: "",
    LocationByName: true,
    locationBy: "",
    prayerTimesEnabledWeb: true,
    permissions: {
      activeOrg: true,
      publications: true,
      adminPanel: true,
    },
    Plz: "",
    Telefon: "",
    imagesUrls: [],
    tvBackgroundUrl: "",
    MosqueID: "",
    Instagram: "",
    Languages: [],
    prayerTimesEnabled: true,
    BankName: "",
    subsIos: 0,
    Kanton: "",
    subs: 0,
    Strasse: "",
    ExtraInfo: "",
    accuratePrayerTimes: true,
  };

  let loading = false;
  let mosque = {};
  let unions = {};
  let languages = {};
  let origMosque = null;
  let errors = {
    Name: [],
    Strasse: [],
    Country: [],
    Plz: [],
    Ort: [],
    Kanton: [],
    DiffToZurich: [],
    MinutesBeforeSunrise: [],
    MinutesAfterFajr: [],
    DhuhrMin: [],
    IshaMin: [],
    lat: [],
    lng: [],
  };
  let logoFile;
  let logo;
  let appLogo;
  let appLogoFile;
  let backgroundFile;
  let background;
  let imageFiles = [];
  let images = [];
  let imagesToDelete = [];
  let countries = $currentUser.settings.countries;
  let regions = $currentUser.settings.regions;
  let mosqueCreateMode = false;
  let newMosqueKey = null;
  $: dataBounds = ($currentUser.settings?.ramadan || {})[new Date().getFullYear()];
  let times = {
    DiffToZurich: 0,
    MinutesBeforeSunrise: 45,
    MinutesAfterFajr: 30,
    DhuhrMin: "00:00",
    IshaMin: "19:00",
  };
  let isSubmitting = false;
  let submitSuccessMessage = "";
  let origManualCoords = null;

  onMount(getLanguages);
  function getLanguages() {
    return firebase
      .firestore()
      .collection("Languages")
      .doc("languages")
      .onSnapshot((snapshot) => {
        languages = snapshot.data();
      });
  }

  onMount(getUnions);
  function getUnions() {
    return firebase
      .firestore()
      .collection("Unions")
      .doc("unions")
      .onSnapshot((snapshot) => {
        unions = snapshot.data();
      });
  }

  const mosque_id = $page.params.mosque_id;
  $: console.log({ mosque_id });
  let mosqueId = "";
  $: if (isMosq($currentUser.user)) {
    mosqueId = $currentUser.user.org.id;
  } else if (isSuperAdmin($currentUser.user)) {
    mosqueId = mosque_id;
  } else if (isUnionAdmin($currentUser.user)) {
    mosqueId = mosque_id;
  }

  $: console.log({ mosque });

  const unsubscribes = [];
  $: if ($currentUser.user) getMosque();
  function getMosque() {
    console.log("getting mosque");
    const pathname = window.location.pathname;

    unsubscribes.forEach((unsubscribe) => unsubscribe());

    if (mosqueId) {
      const unsubscribe = firebase
        .firestore()
        .collection("mosques")
        .doc(mosqueId)
        .onSnapshot((snapshot) => {
          const data = snapshot.data();
          mosque = data;
          origMosque = data;

          const manualCoords = data?.locationBy === "coords";
          const { lat, lng } = data?.coords || {};

          origManualCoords = manualCoords;
          mosque = { ...mosque, lat, lng, manualCoords };
          console.log("finished fetching mosque");

          if (isUnionAdmin($currentUser.user)) {
            if (!data.membership.includes($currentUser.user.org.id)) {
              goto("/mosques");
            }
          }
        });

      mosqueCreateMode = false;

      unsubscribes.push(unsubscribe);
    } else if (pathname === "/mosques/add") {
      const unsubscribe = firebase
        .firestore()
        .collection("mosques")
        .orderBy("MosqueID", "desc")
        .limit(1)
        .onSnapshot((snapshot) => {
          const num = parseInt(snapshot.docs[0].data().MosqueID) + 1;
          const string = num.toString();

          // NOTE: this is to prevent update of the new mosque key mid creation
          if (!newMosqueKey) newMosqueKey = string;
        });
      mosque = {};
      mosqueCreateMode = true;

      unsubscribes.push(unsubscribe);
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      new Compressor(file, {
        maxWidth: 1280,
        maxheight: 720,
        quality: 0.8,
        success(result) {
          resolve(result);
        },
        error(err) {
          reject(new Error("Error: ", err));
        },
      });
    });
  }

  function handleLogoUpload(e) {
    console.log("uploading image");
    const { target } = e;
    const localFile = target.files[0];
    const name = localFile.name;
    const lastDot = name.lastIndexOf(".");
    const fileName = name.substring(0, lastDot);
    const ext = name.substring(lastDot + 1);
    const localImage = {
      id: uuidv4(),
      url: URL.createObjectURL(localFile),
      ext: ext,
      alt: fileName,
    };
    logo = localImage;
    logoFile = localFile;
  }

  function handleAppLogoUpload(e) {
    const { target } = e;
    const localFile = target.files[0];
    const name = localFile.name;
    const lastDot = name.lastIndexOf(".");
    const fileName = name.substring(0, lastDot);
    const ext = name.substring(lastDot + 1);
    const localImage = {
      id: uuidv4(),
      url: URL.createObjectURL(localFile),
      ext: ext,
      alt: fileName,
    };
    appLogo = localImage;
    appLogoFile = localFile;
  }

  function handleBackgroundUpload(e) {
    const { target } = e;
    const localFile = target.files[0];
    const name = localFile.name;
    const lastDot = name.lastIndexOf(".");
    const fileName = name.substring(0, lastDot);
    const ext = name.substring(lastDot + 1);
    const localImage = {
      id: uuidv4(),
      url: URL.createObjectURL(localFile),
      ext: ext,
      alt: fileName,
    };
    background = localImage;
    backgroundFile = localFile;
  }

  function handleImagesUpload(e) {
    const { target } = e;
    const localFiles = target.files;
    const arr = Array.from(localFiles);
    const localImages = arr.map((localFile) => {
      const name = localFile.name;
      const lastDot = name.lastIndexOf(".");
      const fileName = name.substring(0, lastDot);
      const ext = name.substring(lastDot + 1);
      const localImage = {
        id: uuidv4(),
        url: URL.createObjectURL(localFile),
        ext: ext,
        alt: fileName,
      };
      return localImage;
    });

    images = [...images, ...localImages];
    imageFiles = [...imageFiles, ...localFiles];
  }

  async function saveLogo() {
    const compressedFile = await compressImage(logoFile);
    const fileRef = firebase
      .storage()
      .ref()
      .child(`images/mosque/${mosque.MosqueID}/logo.${logo.ext}`);
    return fileRef.put(compressedFile).then(() => fileRef.getDownloadURL());
  }

  async function saveAppLogo() {
    const compressedFile = await compressImage(appLogoFile);
    const fileRef = firebase
      .storage()
      .ref()
      .child(`images/mosque/${mosque.MosqueID}/appLogo.${appLogo.ext}`);
    return fileRef.put(compressedFile).then(() => fileRef.getDownloadURL());
  }

  async function saveBackground() {
    const compressedFile = await compressImage(backgroundFile);
    const fileRef = firebase
      .storage()
      .ref()
      .child(`images/mosque/${mosque.MosqueID}/tvBackground.${background.ext}`);
    return fileRef.put(compressedFile).then(() => fileRef.getDownloadURL());
  }

  async function saveImage(image, i) {
    const compressedFile = await compressImage(imageFiles[i]);
    const fileRef = firebase
      .storage()
      .ref()
      .child(`images/mosque/${mosque.MosqueID}/${image.id}.${image.ext}`);
    if (image.deleted) {
      return Promise.resolve();
    } else {
      return fileRef.put(compressedFile).then(() => fileRef.getDownloadURL());
    }
  }

  function saveImages() {
    return Promise.all(images.map((image, i) => saveImage(image, i)));
  }

  function handleLogoDelete() {
    logo = null;
    logoFile = null;
  }

  function handleAppLogoDelete() {
    appLogo = null;
    appLogoFile = null;
  }

  function handleBackgroundDelete() {
    background = null;
    backgroundFile = null;
  }

  function deleteExistingImage(urlToDelete) {
    imagesToDelete.push(urlToDelete);
    imagesToDelete = imagesToDelete;

    mosque.imagesUrls = mosque.imagesUrls.filter((url) => url !== urlToDelete);
    mosque = mosque;
  }

  function deleteNewImage(imgToDelete) {
    images = images.map((image) => {
      if (image.id === imgToDelete.id) return { ...image, deleted: true };
      else return image;
    });
  }

  function deleteExistingLogo() {
    mosque.logoUrl = null;
    mosque = mosque;
  }

  function deleteExistingAppLogo() {
    mosque.appLogoUrl = null;
    mosque = mosque;
  }

  function deleteExistingBackground() {
    mosque.tvBackgroundUrl = null;
    mosque = mosque;
  }

  function validateField(e, multiple) {
    const { name, value } = e.target;
    const tmpErrors = [];
    if (value.length === 0) {
      tmpErrors.push($_("errors.cantBeEmpty"));
    }
    if (!multiple) {
      errors[name] = tmpErrors;
      errors = errors;
    }
    return tmpErrors;
  }

  function validateForm(e) {
    const requiredFields = document.querySelectorAll(
      "#edit-mosque-form input[required], #edit-mosque-form select[required]"
    );
    const requiredFieldsArr = Array.prototype.slice.call(requiredFields);
    const localErrors = requiredFieldsArr.reduce((acc, field) => {
      const tmpErrors = validateField({ target: field }, true);
      return { ...acc, [field.name]: tmpErrors };
    }, {});
    const hasErrors = Object.keys(localErrors).find((error) => localErrors[error].length > 0);
    if (hasErrors) {
      errors = { ...localErrors };
      return false;
    } else return true;
  }

  function reset() {
    logoFile = null;
    logo = null;
    appLogoFile = null;
    appLogo = null;
    background = null;
    backgroundFile = null;
    imageFiles = [];
    images = [];
    imagesToDelete = [];
  }

  const timeToNumber = (time) => {
    if (time) {
      let [hours, minutes] = time.split(":");
      minutes = parseInt(minutes);
      minutes = minutes / 60;
      return parseInt(hours) + minutes;
    } else console.error("time is not defined");
  };

  const numberToTime = (number) => {
    let hours = Math.floor(number);
    let minutes = Math.round((number - hours) * 60);
    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }
    if (hours < 10) hours = `0${hours}`;
    if (minutes < 10) minutes = `0${minutes}`;
    return `${hours}:${minutes}`;
  };

  function validateTimeField(e, multiple) {
    const { name, value } = e.target;
    const tmpErrors = [];
    if (name === "DiffToZurich") {
      if (value < -30 || value > 30) {
        tmpErrors.push($_("errors.outOfBounds"));
      }
    } else if (name === "MinutesBeforeSunrise") {
      if (value < 0 || value > 120) {
        tmpErrors.push($_("errors.outOfBounds"));
      }
    } else if (name === "MinutesAfterFajr") {
      if (value < 0 || value > 120) {
        tmpErrors.push($_("errors.outOfBounds"));
      }
    } else if (name === "DhuhrMin") {
    } else if (name === "IshaMin") {
    }

    if (!multiple) {
      errors[name] = tmpErrors;
      errors = errors;
    }
    return tmpErrors;
  }

  async function handleSubmit(e) {
    const isValid = validateForm(e);
    if (!isValid) return;

    isSubmitting = true;

    let logoUrl = mosque.logoUrl || null;
    let appLogoUrl = mosque.appLogoUrl || null;
    let tvBackgroundUrl = mosque.tvBackgroundUrl || null;
    let imagesUrls = mosque.imagesUrls || [];
    if (backgroundFile && background) {
      tvBackgroundUrl = await saveBackground();
    }
    if (logoFile && logo) {
      logoUrl = await saveLogo();
    }
    if (appLogoFile && appLogo) {
      appLogoUrl = await saveAppLogo();
    }
    if (imageFiles.length > 0 && images.length > 0) {
      const newUrls = await saveImages();
      imagesUrls = [...imagesUrls, ...newUrls];
    }
    if (imagesToDelete.length > 0) {
      imagesToDelete.forEach((url) => {
        const fileRef = firebase.storage().refFromURL(url);
        return fileRef
          .delete()
          .then(() => {})
          .catch((err) => err);
      });
    }

    if (mosqueCreateMode) {
      const manualCoords = mosque.manualCoords;

      delete mosque.manualCoords;

      const { firstDay, lastDay } = dataBounds;
      await firebase
        .firestore()
        .collection("mosques")
        .doc(newMosqueKey)
        .set({
          ...emptyMosqueTemplate,
          ...mosque,
          MosqueID: newMosqueKey,
          prayerTimesEnabled: true,
          prayerTimesEnabledWeb: true,
          postsEnabledWeb: false,
          postsEnabledApp: true,
        })
        .then(async () => {
          const existingTopic = await firebase
            .firestore()
            .collection("topics")
            .where("org.id", "==", newMosqueKey)
            .get();

          if (existingTopic.docs.length <= 0) {
            await firebase
              .firestore()
              .collection("topics")
              .add({
                org: {
                  id: newMosqueKey,
                  type: "mosque",
                },
                name: "general",
              });
          }
        })
        .then(() => {
          if (!manualCoords) updateCoords();
        });
      await firebase
        .database()
        .ref("prayerTimes/1028/")
        .once("value", async function (snapshot) {
          const templateTimes = snapshot.val();
          const firstRamadanindex = Object.keys(templateTimes).findIndex((x) => x === firstDay);
          const lastRamadanindex = Object.keys(templateTimes).findIndex((x) => x === lastDay);
          const newTimes = Object.keys(templateTimes).reduce((acc, dateKey, i) => {
            const newDateObj = Object.keys(templateTimes[dateKey]).reduce((innerAcc, key) => {
              if (
                key === "Fajr" ||
                key === "Sunrise" ||
                key === "DhuhrTime" ||
                key === "Dhuhr" ||
                key === "Asr" ||
                key === "Maghrib" ||
                key === "IshaTime" ||
                key === "Isha"
              ) {
                const oldTime = timeToNumber(templateTimes[dateKey][key]);
                let newTime = numberToTime(oldTime + times.DiffToZurich / 60);
                if (key === "Dhuhr" || key === "Isha") {
                  if (key === "Dhuhr") {
                    if (times.DhuhrMin === "00:00") {
                      return { ...innerAcc, [key]: newTime };
                    } else {
                      if (timeToNumber(newTime) < timeToNumber(times.DhuhrMin)) {
                        return { ...innerAcc, [key]: times.DhuhrMin };
                      } else {
                        return { ...innerAcc, [key]: newTime };
                      }
                    }
                  } else {
                    if (times.IshaMin === "00:00") {
                      return { ...innerAcc, [key]: newTime };
                    } else {
                      if (timeToNumber(newTime) < timeToNumber(times.IshaMin)) {
                        return { ...innerAcc, [key]: times.IshaMin };
                      } else {
                        return { ...innerAcc, [key]: newTime };
                      }
                    }
                  }
                } else {
                  return { ...innerAcc, [key]: newTime };
                }
              } else if (key === "Sabah") {
                if (i >= firstRamadanindex && i <= lastRamadanindex) {
                  const oldFajr = timeToNumber(templateTimes[dateKey].Fajr);
                  let newFajr = oldFajr + times.DiffToZurich / 60;
                  let newTime = numberToTime(newFajr + times.MinutesAfterFajr / 60);
                  return { ...innerAcc, [key]: newTime };
                } else {
                  const oldSunrise = timeToNumber(templateTimes[dateKey].Sunrise);
                  let newSunrise = oldSunrise + times.DiffToZurich / 60;

                  let newTime = numberToTime(newSunrise - times.MinutesBeforeSunrise / 60);
                  return { ...innerAcc, [key]: newTime };
                }
              } else if (key === "notes") {
                // TODO: ignore notes once we have the alternative sorted out
                return {
                  ...innerAcc,
                  [key]: templateTimes[dateKey][key],
                };
              } else
                return {
                  ...innerAcc,
                  [key]: templateTimes[dateKey][key],
                };
            }, {});
            return { ...acc, [dateKey]: newDateObj };
          }, {});

          const dailyNotes = Object.keys(newTimes).reduce((acc, key) => {
            return { ...acc, [key]: { notes: "" } };
          }, {});

          await firebase.database().ref("notes/").child(newMosqueKey).set(dailyNotes);

          await firebase
            .database()
            .ref("prayerTimes/")
            .child(newMosqueKey)
            .set({ ...newTimes });
        });

      submitSuccessMessage = "mosqueCreateSuccess";

      setTimeout(() => {
        goto("/mosques/" + newMosqueKey);
      }, 1000);
    } else {
      mosque.coords.lng = Number(mosque.lng);
      mosque.coords.lat = Number(mosque.lat);

      const manualCoords = mosque.manualCoords;

      delete mosque.manualCoords;

      delete mosque.lng;
      delete mosque.lat;

      if (manualCoords) {
        mosque.locationBy = "coords";
      }

      await firebase
        .firestore()
        .collection("mosques")
        // .doc(currentUser.org.id)
        .doc(mosqueId)
        .update({
          ...mosque,
          logoUrl,
          appLogoUrl,
          tvBackgroundUrl,
          imagesUrls,
        })
        .then(() => {
          if (
            origMosque.Name !== mosque.Name ||
            origMosque.Strasse !== mosque.Strasse ||
            origMosque.Ort !== mosque.Ort ||
            origMosque.Kanton !== mosque.Kanton ||
            origManualCoords !== manualCoords
          ) {
            if (!manualCoords) updateCoords();
          }
        })
        .then(() => {
          reset();
        });

      submitSuccessMessage = "mosqueEditSuccess";
    }

    isSubmitting = false;
  }

  // async function seedNotes() {
  //   console.log("seeding notes");
  //   await firebase
  //     .database()
  //     .ref("prayerTimes/")
  //     .once("value", async function (snapshot) {
  //       const allMosques = snapshot.val();

  //       for (const mosqueId in allMosques) {
  //         const dailyNotes = Object.keys(allMosques[mosqueId]).reduce((acc, key) => {
  //           return { ...acc, [key]: allMosques[mosqueId]?.Notes || "" };
  //         }, {});

  //         await firebase.database().ref("dailyNotes/").child(mosqueId).set(dailyNotes);
  //         console.log("migrated daily notes for", mosqueId);
  //       }
  //     });
  // }

  // onMount(() => {
  //   seedNotes();
  // });

  function updateCoords() {
    loader.load().then(() => {
      const geocoder = new window.google.maps.Geocoder();
      let address = `${mosque.Name}, ${mosque.Strasse}, ${mosque.Ort}, ${mosque.Kanton}`;
      geocoder.geocode(
        {
          address: address,
        },
        (results, status) => {
          if (status === "OK" && !results[0].partial_match) {
            firebase
              .firestore()
              .collection("mosques")
              // .doc(currentUser.org.id)
              .doc(mosqueCreateMode ? newMosqueKey : mosqueId)
              .update({
                LocationByName: true,
                locationBy: "name_address",
                coords: {
                  lat: results[0].geometry.location.lat(),
                  lng: results[0].geometry.location.lng(),
                },
              });
          } else {
            address = `${mosque.Strasse}, ${mosque.Ort}, ${mosque.Kanton}`;
            geocoder.geocode(
              {
                address: address,
              },
              (results, status) => {
                if (status === "OK") {
                  firebase
                    .firestore()
                    .collection("mosques")
                    // .doc(currentUser.org.id)
                    .doc(mosqueCreateMode ? newMosqueKey : mosqueId)
                    .update({
                      LocationByName: false,
                      locationBy: "address",
                      coords: {
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng(),
                      },
                    });
                } else {
                  // console.error(
                  //   "Error: " + "geocode of " + address + " failed:" + status
                  // );
                }
              }
            );
          }
        }
      );
    });
  }

  // TODO: render using svelte methods
  function renderMembershipOptions(country) {
    const def = [{ value: 0, label: $_("addMembership") }];

    const options = Object.entries(unions)
      .filter(([key, val]) => val.Country === country)
      .map(([key, val]) => {
        if (mosque.membership && mosque.membership.length && mosque.membership.includes(key)) {
          return null;
        }

        return {
          value: key,
          label: val.Shortname + " - " + val.Fullname,
        };
      })
      .filter(Boolean);

    return [...def, ...options];
  }

  function addMembership(e) {
    const { value } = e.target;
    if (value && value !== "0") {
      const newMembership = mosque.membership || [];
      const set = new Set(newMembership);
      set.add(value);
      const arr = Array.from(set);

      mosque.membership = arr;
      mosque = mosque;
    }
  }

  function addLanguage(e) {
    const { value } = e.target;
    if (value && value !== "0") {
      const newLanguages = mosque.Languages || [];
      const set = new Set(newLanguages);
      set.add(value);
      const arr = Array.from(set);

      mosque.Languages = arr;
      mosque = mosque;
    }
  }

  function renderLanguageOptions() {
    const def = [{ value: 0, label: $_("addLanguage") }];
    const options = Object.entries(languages)
      .map(([key, val]) => {
        if (mosque.Languages && !mosque.Languages.includes(key)) {
          return {
            value: key,
            label: val.LanguageName,
          };
        } else if (!mosque.Languages) {
          return {
            value: key,
            label: val.LanguageName,
          };
        }
        return null;
      })
      .filter(Boolean);

    return [...def, ...options];
  }

  function renderSelectedMemberships(e) {
    if (Array.isArray(mosque.membership) && mosque.membership.length > 0) {
      return mosque.membership.map((x) => {
        return {
          dataId: x,
          label: unions[x] && unions[x].Shortname,
          icon: faTimes,
          clickHandler: handleMembershipDelete,
        };
      });
    }
  }

  function renderSelectedLanguages(e) {
    if (Array.isArray(mosque.Languages) && mosque.Languages.length > 0) {
      return mosque.Languages.map((x) => {
        return {
          dataId: x,
          label: languages[x] && languages[x].LanguageName,
          icon: faTimes,
          clickHandler: handleLanguageDelete,
        };
      });
    }
  }

  function handleMembershipDelete(id) {
    mosque.membership = mosque.membership.filter((x) => x !== id);
    mosque = mosque;
  }

  function handleLanguageDelete(id) {
    mosque.Languages = mosque.Languages.filter((x) => x !== id);
    mosque = mosque;
  }

  function changeCountry(e) {
    const { value } = e.target;
    validateField(e);

    mosque.Country = value;
    mosque.Kanton = "";
    mosque = mosque;
  }

  function changeRegion(e) {
    const { value } = e.target;
    validateField(e);

    mosque.Kanton = value;
    mosque = mosque;
  }
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal"
    style="display: flex; justify-content: space-between; padding: 1rem"
  >
    {#if mosqueCreateMode}
      <h1>{$_("addMosque")}</h1>
    {:else}
      <h1>{$_("settings")}</h1>
    {/if}

    <li class="custom-menu__item">
      <a href="/mosques">
        <button class="btn btn-primary">
          {$_("back")}
        </button>
      </a>
    </li>
  </ul>
</div>

<div class:hidden={$currentUser.user}>
  <Spinner color="primary" />
</div>

<div class="wrapper" class:hidden={!$currentUser.user}>
  <Form>
    <TabContent>
      <TabPane tabId="name-and-address" tab={$_("nameAndAddress")} active>
        <div class="spacer" />

        <FormGroup>
          <Label>{$_("nameInTheApp")}</Label>
          <Input
            type="text"
            placeholder={$_("nameInTheApp")}
            name="Name"
            bind:value={mosque.Name}
            on:input={(e) => {
              errors.Name.length > 0 && validateField(e);
            }}
            on:blur={validateField}
            required
            invalid={!mosque.Name || errors.Name.length > 0}
          />
          {#if errors.Name.length}
            <p class="invalid-feedback">
              {errors.Name}
            </p>
          {/if}
        </FormGroup>

        <FormGroup>
          <Label>{$_("officialName")}</Label>
          <Input
            type="text"
            placeholder={$_("officialName")}
            name="OffiziellerName"
            bind:value={mosque.OffiziellerName}
          />
        </FormGroup>

        <FormGroup>
          <Label>{$_("street")}</Label>
          <Input
            type="text"
            placeholder={$_("street")}
            name="Strasse"
            bind:value={mosque.Strasse}
            on:input={(e) => {
              errors.Strasse.length > 0 && validateField(e);
            }}
            on:blur={validateField}
            required
            invalid={!mosque.Strasse || errors.Strasse.length > 0}
          />
          {#if errors.Strasse.length}
            <p class="invalid-feedback">
              {errors.Strasse}
            </p>
          {/if}
        </FormGroup>

        <FormGroup>
          <Label>{$_("zip")}</Label>
          <Input
            type="text"
            placeholder={$_("zip")}
            name="Plz"
            bind:value={mosque.Plz}
            on:input={(e) => {
              errors.Plz.length > 0 && validateField(e);
            }}
            on:blur={validateField}
            required
            invalid={!mosque.Plz || errors.Plz.length > 0}
          />
          {#if errors.Plz.length}
            <p class="invalid-feedback">
              {errors.Plz}
            </p>
          {/if}
        </FormGroup>

        <FormGroup>
          <Label>{$_("city")}</Label>
          <Input
            type="text"
            placeholder={$_("city")}
            name="Ort"
            bind:value={mosque.Ort}
            on:input={(e) => {
              errors.Ort.length > 0 && validateField(e);
            }}
            on:blur={validateField}
            required
            invalid={!mosque.Ort || errors.Ort.length > 0}
          />
          {#if errors.Ort.length}
            <p class="invalid-feedback">
              {errors.Ort}
            </p>
          {/if}
        </FormGroup>

        <FormGroup>
          <Label for="country-select">{$_("Country")}</Label>
          <select
            class="form-select form-control select-arrow-none ih-medium radius-xs b-light shadow-none color-light fs-14"
            bind:value={mosque.Country}
            name="Country"
            required
            class:is-invalid={!mosque.Country || errors.Country.length > 0}
          >
            <option disabled selected value={""} />
            {#each $currentUser.settings?.countries || [] as country}
              <option value={country}>{$_(country)}</option>
            {/each}
          </select>
          {#if errors.Country.length}
            <p class="invalid-feedback">
              {errors.Country}
            </p>
          {/if}
        </FormGroup>

        <FormGroup>
          <Label>{$_("state")}</Label>
          <select
            class="form-select form-control select-arrow-none ih-medium radius-xs b-light shadow-none color-light fs-14"
            bind:value={mosque.Kanton}
            name="Kanton"
            required
            class:is-invalid={!mosque.Kanton || errors.Kanton.length > 0}
            disabled={mosque.Country === ""}
          >
            <option value={""} />
            {#if $currentUser.settings.regions}
              {#each $currentUser.settings.regions[mosque.Country] || [] as region}
                <option value={region}>{region}</option>
              {/each}
            {/if}
          </select>
          {#if errors.Kanton.length}
            <p class="invalid-feedback">
              {errors.Kanton}
            </p>
          {/if}
        </FormGroup>

        <FormGroup>
          <Input type="checkbox" bind:checked={mosque.manualCoords} label={$_("manualCoords")} />
        </FormGroup>

        <FormGroup>
          <Label>{$_("lat")}</Label>
          <Input
            type="text"
            placeholder={$_("lat")}
            name="lat"
            bind:value={mosque.lat}
            on:input={(e) => {
              errors.lat.length > 0 && validateField(e);
            }}
            on:blur={validateField}
            invalid={(mosque.manualCoords && !mosque.lat) || errors.lat.length > 0}
            disabled={!mosque.manualCoords}
          />
          {#if errors.lat.length}
            <p class="invalid-feedback">
              {errors.lat}
            </p>
          {/if}
        </FormGroup>

        <FormGroup>
          <Label>{$_("lng")}</Label>
          <Input
            type="text"
            placeholder={$_("lng")}
            name="lng"
            bind:value={mosque.lng}
            on:input={(e) => {
              errors.lng.length > 0 && validateField(e);
            }}
            on:blur={validateField}
            invalid={(mosque.manualCoords && !mosque.lng) || errors.lng.length > 0}
            disabled={!mosque.manualCoords}
          />
          {#if errors.lng.length}
            <p class="invalid-feedback">
              {errors.lng}
            </p>
          {/if}
        </FormGroup>
      </TabPane>

      <TabPane tabId="contact-and-social-media" tab={$_("contactAndSocialMedia")}>
        <div class="spacer" />

        <FormGroup>
          <Label>{$_("phone")}</Label>
          <Input type="text" placeholder={$_("phone")} name="Telefon" bind:value={mosque.Telefon} />
        </FormGroup>

        <FormGroup>
          <Label>{$_("email")}</Label>
          <Input type="text" placeholder={$_("email")} name="Email" bind:value={mosque.Email} />
        </FormGroup>

        <FormGroup>
          <Label>{$_("website")}</Label>
          <Input
            type="text"
            placeholder={$_("website")}
            name="Website"
            bind:value={mosque.Website}
          />
        </FormGroup>

        <FormGroup>
          <Label>{$_("Facebook")}</Label>
          <Input
            type="text"
            placeholder={$_("Facebook")}
            name="Facebook"
            bind:value={mosque.Facebook}
          />
        </FormGroup>

        <FormGroup>
          <Label>{$_("Instagram")}</Label>
          <Input
            type="text"
            placeholder={$_("Instagram")}
            name="Instagram"
            bind:value={mosque.Instagram}
          />
        </FormGroup>

        <FormGroup>
          <Label>{$_("YouTube")}</Label>
          <Input
            type="text"
            placeholder={$_("YouTube")}
            name="YouTube"
            bind:value={mosque.YouTube}
          />
        </FormGroup>
      </TabPane>

      <TabPane tabId="extras" tab={$_("extras")}>
        <div class="spacer" />

        <FormGroup>
          <Label>{$_("membership")}</Label>

          <div
            class="languages"
            style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem;"
          >
            {#each mosque.membership || [] as membership}
              <Button
                class="fs-15 fw-400 text-capitalize"
                color="primary"
                size="xs"
                on:click={() => handleMembershipDelete(membership)}
              >
                {unions[membership]?.Shortname}
                &nbsp;
                <Fa icon={faTrash} />
              </Button>
            {/each}
          </div>

          <select
            on:change={addMembership}
            class="form-select form-control select-arrow-none ih-medium radius-xs b-light shadow-none color-light fs-14"
          >
            {#key unions}
              {#key mosque.membership}
                {#each renderMembershipOptions(mosque.Country) as { value, label }}
                  <option {value}>{label}</option>
                {/each}
              {/key}
            {/key}
          </select>
        </FormGroup>

        <FormGroup>
          <Label>{$_("languages")}</Label>

          <div
            class="languages"
            style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem;"
          >
            {#each mosque.Languages || [] as language (language)}
              <Button
                on:click={() => handleLanguageDelete(language)}
                class="fs-15 fw-400 text-capitalize"
                color="primary"
                size="xs"
              >
                {languages[language]?.LanguageName}
                <Fa icon={faTrash} />
              </Button>
            {/each}
          </div>

          <select
            on:change={addLanguage}
            class="form-select form-control select-arrow-none ih-medium radius-xs b-light shadow-none color-light fs-14"
          >
            {#key languages}
              {#key mosque.Languages}
                {#each renderLanguageOptions() as { value, label }}
                  <option {value}>{label}</option>
                {/each}
              {/key}
            {/key}
          </select>
        </FormGroup>

        <FormGroup>
          <Label>{$_("bankName")}</Label>
          <Input
            type="text"
            placeholder={$_("bankName")}
            name="BankName"
            bind:value={mosque.BankName}
          />
        </FormGroup>

        <FormGroup>
          <Label>{$_("IBAN")}</Label>
          <Input type="text" placeholder={$_("IBAN")} name="IBAN" bind:value={mosque.IBAN} />
        </FormGroup>

        <FormGroup>
          <Label>{$_("ExtraInfo")}</Label>
          <Input
            type="textarea"
            rows="4"
            placeholder={$_("ExtraInfoPlaceholder")}
            name="ExtraInfo"
            bind:value={mosque.ExtraInfo}
          />
        </FormGroup>

        {#if mosqueCreateMode}
          <FormGroup>
            <Label>{$_("minsDiffZurich")}</Label>
            <Input
              type="text"
              placeholder={$_("minsDiffZurich")}
              name="DiffToZurich"
              bind:value={times.DiffToZurich}
              on:input={(e) => {
                errors.DiffToZurich.length > 0 && validateField(e);
              }}
              on:blur={validateField}
              invalid={times.DiffToZurich < 0 || errors.DiffToZurich.length > 0}
            />
            {#if errors.DiffToZurich.length}
              <p class="invalid-feedback">
                {errors.DiffToZurich}
              </p>
            {/if}
          </FormGroup>

          <FormGroup>
            <Label>{$_("sabahMinsBefSunrise")}</Label>
            <Input
              type="text"
              placeholder={$_("sabahMinsBefSunrise")}
              name="MinutesBeforeSunrise"
              bind:value={times.MinutesBeforeSunrise}
              on:input={(e) => {
                errors.MinutesBeforeSunrise.length > 0 && validateField(e);
              }}
              on:blur={validateField}
              invalid={!times.MinutesBeforeSunrise || errors.MinutesBeforeSunrise.length > 0}
            />
            {#if errors.MinutesBeforeSunrise.length}
              <p class="invalid-feedback">
                {errors.MinutesBeforeSunrise}
              </p>
            {/if}
          </FormGroup>

          <FormGroup>
            <Label>{$_("dhuhrMin")}</Label>
            <Input
              type="text"
              placeholder={$_("dhuhrMin")}
              name="DhuhrMin"
              bind:value={times.DhuhrMin}
              on:input={(e) => {
                errors.DhuhrMin.length > 0 && validateField(e);
              }}
              on:blur={validateField}
              invalid={!times.DhuhrMin || errors.DhuhrMin.length > 0}
            />
            {#if errors.DhuhrMin.length}
              <p class="invalid-feedback">
                {errors.DhuhrMin}
              </p>
            {/if}
          </FormGroup>

          <FormGroup>
            <Label>{$_("ishaMin")}</Label>
            <Input
              type="text"
              placeholder={$_("ishaMin")}
              name="IshaMin"
              bind:value={times.IshaMin}
              on:input={(e) => {
                errors.IshaMin.length > 0 && validateField(e);
              }}
              on:blur={validateField}
              invalid={!times.IshaMin || errors.IshaMin.length > 0}
            />
            {#if errors.IshaMin.length}
              <p class="invalid-feedback">
                {errors.IshaMin}
              </p>
            {/if}
          </FormGroup>
        {/if}
      </TabPane>
      <TabPane tabId="images" tab={$_("images")}>
        <div class="spacer" />

        {#if logo}
          <span class="fs-15 fw-400 text-capitalize">{$_("logo")}</span>
          <div style="display: flex; flex-direction: column;">
            <img src={logo.url} alt="" style="height: 150px; object-fit: cover; display: block;" />
            <Button
              on:click={handleLogoDelete}
              color="primary"
              class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
              style="width: 100%"
            >
              <Fa icon={faTrash} size="lg" />
            </Button>
          </div>
        {:else if mosque.logoUrl}
          <span class="fs-15 fw-400 text-capitalize">{$_("logo")}</span>
          <div style="display: flex; flex-direction: column;">
            <img
              src={mosque.logoUrl}
              alt=""
              style="height: 150px; object-fit: cover; display: block;"
            />
            <Button
              on:click={deleteExistingLogo}
              color="primary"
              class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
              style="width: 100%"
            >
              <Fa icon={faTrash} size="lg" />
            </Button>
          </div>
        {:else}
          <FormGroup>
            <Button>
              <Label for="logoInput" style="margin: 0; cursor: pointer;">
                {$_("addLogo")}
              </Label>
            </Button>

            <Input
              id="logoInput"
              type="file"
              accept="image/*"
              on:change={handleLogoUpload}
              style="display: none"
            />
          </FormGroup>
        {/if}

        <div class="spacer" />

        {#if appLogo}
          <span class="fs-15 fw-400 text-capitalize">{$_("appLogo")}</span>
          <div style="display: flex; flex-direction: column;">
            <img
              src={appLogo.url}
              alt=""
              style="height: 150px; object-fit: cover; display: block;"
            />
            <Button
              on:click={handleAppLogoDelete}
              color="primary"
              class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
              style="width: 100%"
            >
              <Fa icon={faTrash} size="lg" />
            </Button>
          </div>
        {:else if mosque.appLogoUrl}
          <span class="fs-15 fw-400 text-capitalize">{$_("logo")}</span>
          <div style="display: flex; flex-direction: column;">
            <img
              src={mosque.appLogoUrl}
              alt=""
              style="height: 150px; object-fit: cover; display: block;"
            />
            <Button
              on:click={deleteExistingAppLogo}
              color="primary"
              class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
              style="width: 100%"
            >
              <Fa icon={faTrash} size="lg" />
            </Button>
          </div>
        {:else}
          <FormGroup>
            <Button>
              <Label for="appLogoInput" style="margin: 0; cursor: pointer;">
                {$_("addAppLogo")}
              </Label>
            </Button>

            <Input
              id="appLogoInput"
              type="file"
              accept="image/*"
              on:change={handleAppLogoUpload}
              style="display: none"
            />
          </FormGroup>
        {/if}

        <div class="spacer" />

        <FormGroup>
          {#if images.filter((i) => !i.deleted).length || mosque.imageUrls?.length}
            <span class="fs-15 fw-400 text-capitalize">{$_("images")}</span>
          {/if}

          {#each mosque.imagesUrls || [] as url}
            <div style="display: flex; flex-direction: column;">
              <img src={url} alt="" style="height: 150px; object-fit: cover; display: block;" />
              <Button
                on:click={() => deleteExistingImage(url)}
                color="primary"
                class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
                style="width: 100%"
              >
                <Fa icon={faTrash} size="lg" />
              </Button>
            </div>
          {/each}

          {#each images as image}
            {#if !image.deleted}
              <div style="display: flex; flex-direction: column;">
                <img
                  src={image.url}
                  alt=""
                  style="height: 150px; object-fit: cover; display: block;"
                />
                <Button
                  on:click={() => deleteNewImage(image)}
                  color="primary"
                  class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
                  style="width: 100%"
                >
                  <Fa icon={faTrash} size="lg" />
                </Button>
              </div>
            {/if}
          {/each}

          <Button>
            <Label for="imagesInput" style="margin: 0; cursor: pointer;">
              {$_("addImages")}
            </Label>
          </Button>

          <Input
            id="imagesInput"
            type="file"
            accept="image/*"
            on:change={handleImagesUpload}
            style="display: none"
            multiple={true}
          />
        </FormGroup>

        <div class="spacer" />

        {#if background}
          <span class="fs-15 fw-400 text-capitalize">{$_("tvBackground")}</span>
          <div style="display: flex; flex-direction: column;">
            <img
              src={background.url}
              alt=""
              style="height: 150px; object-fit: cover; display: block;"
            />
            <Button
              on:click={handleBackgroundDelete}
              color="primary"
              class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
              style="width: 100%"
            >
              <Fa icon={faTrash} size="lg" />
            </Button>
          </div>
        {:else if mosque.tvBackgroundUrl}
          <span class="fs-15 fw-400 text-capitalize">{$_("tvBackground")}</span>
          <div style="display: flex; flex-direction: column;">
            <img
              src={mosque.tvBackgroundUrl}
              alt=""
              style="height: 150px; object-fit: cover; display: block;"
            />
            <Button
              on:click={deleteExistingBackground}
              color="primary"
              class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
              style="width: 100%"
            >
              <Fa icon={faTrash} size="lg" />
            </Button>
          </div>
        {:else}
          <FormGroup>
            <Button>
              <Label for="backgroundInput" style="margin: 0; cursor: pointer;">
                {$_("addBackground")}
              </Label>
            </Button>

            <Input
              id="backgroundInput"
              type="file"
              accept="image/*"
              on:change={handleBackgroundUpload}
              style="display: none"
            />
          </FormGroup>
        {/if}
      </TabPane>
    </TabContent>
  </Form>

  <Button style="display: block; width: 100%; margin-top: 2rem;" on:click={handleSubmit}>
    {#if isSubmitting}
      <Spinner color="secondary" />
    {:else if mosqueCreateMode}
      {$_("addMosque")}
    {:else}
      {$_("saveChanges")}
    {/if}
  </Button>
</div>

<style lang="scss">
  .wrapper {
    max-width: 542px;
    margin: 0 auto;
    padding: 1rem;

    .spacer {
      height: 1rem;
    }
  }

  .hidden {
    display: none;
  }
</style>
