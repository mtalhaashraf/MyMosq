<script>
  import { onDestroy, onMount } from "svelte";
  import firebase from "$lib/firebase.js";
  import { _ } from "svelte-i18n";
  import { isUnionAdmin, isMosqAdmin, isMosqPublisher } from "@utility/helpers.js";
  import {
    Alert,
    Col,
    Card,
    CardHeader,
    CardBody,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownToggle,
    Nav,
  } from "sveltestrap";
  import { currentUser } from "@store/currentUser.js";
  import * as XLSX from "xlsx";

  let data = {};
  let activeMonth = new Date().getMonth();
  let activeYear = new Date().getFullYear();

  $: canEditNotes =
    $currentUser.user?.canEditNotes ||
    isMosqAdmin($currentUser.user) ||
    isUnionAdmin($currentUser.user);

  function convertDBDateToDate(str = "") {
    const year = parseInt(str.slice(0, 4));
    const month = parseInt(str.slice(4, 6));
    const date = parseInt(str.slice(6));

    return new Date(year, month - 1, date);
  }

  function convertDBDateToString(d) {
    return formatDateToCustomFormat(convertDBDateToDate(d));
  }

  function formatDateToCustomFormat(d) {
    let day = d.getDate();
    if (day < 10) day = `0${day}`;
    let month = d.getMonth() + 1;
    if (month < 10) month = `0${month}`;
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function formatStrToDate(d) {
    const arr = d.split(".");
    return new Date(arr[2], arr[1] - 1, arr[0]);
  }

  function parseNote(val) {
    const regex = /\n/g;
    if (regex.test(val)) {
      val = val.replaceAll(regex, "\\n");
    }
    return val;
  }

  function getDayFromDate(date) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    return days[date.getDay()];
  }

  $: if ($currentUser.user) fetchData();

  let rerenderTable = 1;
  function fetchData() {
    console.log("fetching data");

    // NOTE: this becomes universal as well

    const unsubscribe = firebase
      .database()
      .ref("notes/" + $currentUser.user.org.id)
      .on("value", function (snapshot) {
        if (snapshot) {
          console.log("snapshot available");

          data = snapshot.val() || {};
        }
      });

    onDestroy(unsubscribe);
    // if (isUnionAdmin($currentUser.user)) {
    //   const unsubscribe = firebase
    //     .database()
    //     .ref("dailyNotes/" + $currentUser.user.org.id)
    //     .on("value", function (snapshot) {
    //       if (snapshot) {
    //         console.log("snapshot available");

    //         data = snapshot.val();
    //       }
    //     });

    //   onDestroy(unsubscribe);
    // }
    // if (isMosqAdmin($currentUser.user) || isMosqPublisher($currentUser.user)) {
    //   const unsubscribe = firebase
    //     .database()
    //     .ref("prayerTimes/" + $currentUser.user.org.id)
    //     .on("value", function (snapshot) {
    //       if (snapshot) {
    //         console.log("snapshot available");

    //         const convertedData = {};
    //         Object.entries(snapshot.val()).forEach(([item, value]) => {
    //           convertedData[parseInt(item)] = value.Notes;
    //         });
    //         data = convertedData;
    //       }
    //     });
    //   onDestroy(unsubscribe);
    // }
  }

  $: filteredData = Object.entries(data)
    .filter(([key]) => {
      const noteYear = convertDBDateToDate(key).getFullYear();
      return Number(noteYear) === Number(activeYear);
    })
    .filter(([key]) => {
      const noteMonth = convertDBDateToDate(key).getMonth() + 1;
      return Number(noteMonth) === Number(activeMonth) + 1 || Number(activeMonth) === -1;
    });

  $: console.log({ filteredData });

  const months = [
    "wholeYear",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function handleMonthChange(e) {
    e.preventDefault();
    activeMonth = parseInt(e.target.dataset.value);
  }

  function handleYearChange(e) {
    e.preventDefault();
    activeYear = parseInt(e.target.dataset.value);
  }

  function handleKeyDown(e) {
    const { keyCode, currentTarget } = e;
    if (keyCode === 13) {
      // enter
      e.preventDefault();
      const nextRow = currentTarget.parentElement.nextElementSibling;
      if (nextRow) nextRow.querySelector("[data-name=note]").focus();
    }
  }

  function notesToDbFormat(val) {
    const regex = /\\n/g;
    if (regex.test(val)) {
      val = val.replaceAll(regex, "\n");
    }
    return val;
  }

  async function textChangeHandler(e) {
    // NOTE: every distinction is now common
    let dataId = e.currentTarget.getAttribute("data-id");
    let val = e.currentTarget.textContent;
    val = notesToDbFormat(val);

    if (val !== data[parseInt(dataId)]) {
      let query = firebase.database().ref("notes/" + $currentUser.user.org.id + "/" + dataId);
      query.update({ notes: val });

      e.target.innerText = val;
    }

    // if (isUnionAdmin($currentUser.user)) {
    //   let dataId = e.currentTarget.getAttribute("data-id");
    //   let val = e.currentTarget.textContent;
    //   val = notesToDbFormat(val);

    //   if (val !== data[parseInt(dataId)]) {
    //     let query = firebase
    //       .database()
    //       .ref("dailyNotes/" + $currentUser.user.org.id + "/" + dataId);
    //     query.set(val);

    //     e.target.innerText = val;
    //   }
    // }

    // if (isMosqAdmin($currentUser.user) || isMosqPublisher($currentUser.user)) {
    //   let dataId = e.currentTarget.getAttribute("data-id");
    //   let val = e.currentTarget.textContent;
    //   val = notesToDbFormat(val);

    //   if (val !== data[parseInt(dataId)]) {
    //     let query = firebase
    //       .database()
    //       .ref("prayerTimes/" + $currentUser.user.org.id + "/" + dataId);
    //     const originalData = (await query.get()).val();
    //     query.set({ ...originalData, Notes: val });

    //     e.target.innerText = val;
    //   }
    // }
  }

  function handleExport() {
    const exportData = filteredData.map(([key, value]) => {
      return [convertDBDateToString(key), $_(getDayFromDate(convertDBDateToDate(key))), value];
    });
    exportData.unshift(["Date", "Day", "Note"]);

    const user = $currentUser.user;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "DailyNotes");

    const today = new Date();
    let str = formatDateToCustomFormat(today);
    str = str.split(".").join("-");

    let exportName = "MyMosq_DailyNotes.xlsx";
    if (isMosqAdmin(user)) {
      exportName = `MyMosq_${str}_${user.org.Ort}-${user.org.Kanton}_${user.org.Name}_DailyNotes.xlsx`;
    } else if (isUnionAdmin(user)) {
      exportName = `MyMosq_${str}_${user.org.Shortname}_DailyNotes.xlsx`;
    }

    XLSX.writeFileXLSX(wb, exportName);
  }

  function validateDate(date) {
    if (typeof date === "number") {
      const epoch = new Date("1.1.1900");
      const fullDaysSinceJsEpoch = Math.floor(epoch / 8.64e7);
      const d = new Date((date + fullDaysSinceJsEpoch - 1) * 8.64e7);
      return formatDateToCustomFormat(d);
    } else {
      const ddmmyyyy = new RegExp("^([0-2][0-9]|(3)[0-1])(\\.)(((0)[0-9])|((1)[0-2]))(\\.)\\d{4}$");
      if (ddmmyyyy.test(date)) {
        const d = formatStrToDate(date);
        // eslint-disable-next-line
        if (d.getTime() === d.getTime()) {
          return formatDateToCustomFormat(d);
        } else return false;
      } else return false;
    }
  }

  let hiddenFileInput;
  let showImportSuccessMessage = "";

  const readExcel = (file) => {
    const promise = new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.readAsArrayBuffer(file);
      fileReader.onload = (e) => {
        const bufferArray = e.target.result;
        const wb = XLSX.read(bufferArray, { type: "buffer" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const excelData = XLSX.utils.sheet_to_json(ws);

        const unique = [];

        console.log({ excelData });
        reject({ excelData });
        return;

        excelData.forEach((item) => {
          const { Date: key, Note: value } = item;
          const dataKey = key.split(".").reverse().join("");

          if (!validateDate(key)) return;
          if (data[dataKey] === value) return;

          unique.push({ [dataKey]: value || "" });
        });

        resolve(unique);
      };
      fileReader.onerror = (err) => {
        reject(err);
      };
    });
    promise.then(async (unique) => {
      // NOTE: this become universal if there's no distinction between mosque and union daily notes structure
      const dataRef = firebase.database().ref("notes/" + $currentUser.user.org.id);

      let finalData = {
        ...data,
      };
      unique.forEach((obj) => Object.assign(finalData, obj));

      dataRef.set(finalData);

      showImportSuccessMessage = $_("importSuccess");
      setTimeout(() => {
        showImportSuccessMessage = "";
      }, 5000);

      //   if (isUnionAdmin($currentUser.user)) {
      //     const dataRef = firebase.database().ref("dailyNotes/" + $currentUser.user.org.id);

      //     let finalData = {
      //       ...data,
      //     };
      //     unique.forEach((obj) => Object.assign(finalData, obj));

      //     dataRef.set(finalData);

      //     showImportSuccessMessage = $_("importSuccess");
      //     setTimeout(() => {
      //       showImportSuccessMessage = "";
      //     }, 5000);

      //     // fetchData();
      //   }

      //   if (isMosqAdmin($currentUser.user)) {
      //     const dataRef = firebase.database().ref("prayerTimes/" + $currentUser.user.org.id);

      //     const dataToUpdate = (await dataRef.get()).val();

      //     unique.forEach((item) => {
      //       const [key, value] = Object.entries(item)[0];
      //       const oldData = dataToUpdate[key];

      //       const newData = {
      //         ...oldData,
      //         Notes: value,
      //       };

      //       dataToUpdate[key] = newData;
      //     });

      //     dataRef.set(dataToUpdate);

      //     showImportSuccessMessage = $_("importSuccess");
      //     setTimeout(() => {
      //       showImportSuccessMessage = "";
      //     }, 5000);

      //     // fetchData();
      //   }

      rerenderTable++;
    });
  };
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal"
    style="display: flex; justify-content: space-between; padding: 1rem"
  >
    <div class="custom-menu__item">
      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {$_(months[activeMonth + 1])}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          {#each [...new Array(13).keys()] as mIndex}
            <a class="dropdown-item" on:click={handleMonthChange} href="#" data-value={mIndex - 1}>
              {$_(months[mIndex])}
            </a>
          {/each}
        </div>
      </li>
      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {activeYear}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          <a class="dropdown-item" on:click={handleYearChange} href="#" data-value={2023}>2023</a>
        </div>
      </li>
    </div>

    {#if canEditNotes}
      <div class="custom-menu__item" style="display: flex;">
        <li class="custom-menu__item">
          <button class="btn btn-primary" on:click={() => hiddenFileInput.click()}>
            {$_("import")}
          </button>
        </li>

        <input
          type="file"
          bind:this={hiddenFileInput}
          on:change={(e) => readExcel(e.target.files[0])}
          on:click={(e) => (e.target.value = null)}
          style="display: none"
        />

        <li class="custom-menu__item">
          <button class="btn btn-primary" on:click={handleExport}>
            {$_("export")}
          </button>
        </li>
      </div>
    {/if}
  </ul>
</div>

{#if showImportSuccessMessage}
  <Alert color="success">
    <div class="alert-content">
      <p>{showImportSuccessMessage}</p>
    </div>
  </Alert>
{/if}

{#key rerenderTable}
  <div class="table-responsive">
    <table class="table table-basic table-borderless">
      <thead>
        <tr>
          <th style="width: 2rem">{$_("Date")}</th>
          <th style="width: 2rem">{$_("Day")}</th>
          {#if canEditNotes}
            <th>{$_("notes")}</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each filteredData as [key, value]}
          <tr>
            <td style={{ cursor: "default", width: "0.1%" }}>
              {convertDBDateToString(key)}
            </td>
            <td>{$_(getDayFromDate(convertDBDateToDate(key)))}</td>
            {#if canEditNotes}
              <td
                data-name="note"
                data-id={key}
                style="whiteSpace: nowrap; textAlign: start; paddingLeft: 8px;"
                contentEditable
                suppressContentEditableWarning
                on:keydown={handleKeyDown}
                on:blur={textChangeHandler}
              >
                {parseNote(value.notes === undefined ? value : value.notes)}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/key}

<style>
  tr:nth-child(even),
  tr:nth-child(even) td {
    background-color: #f2f2f2;
  }
</style>
