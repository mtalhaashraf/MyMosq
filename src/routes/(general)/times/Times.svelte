<script>
  import { _ } from "svelte-i18n";
  import { currentUser } from "@store/currentUser.js";
  import { isMosqAdmin, isUnionAdmin, isMosq, isSuperAdmin } from "@utility/helpers.js";
  import { onDestroy, onMount } from "svelte";
  import moment from "moment";
  import { hMoment } from "@utility/hmoment.js";
  import Fa from "svelte-fa";
  import { faPen } from "@fortawesome/free-solid-svg-icons";
  import { goto } from "$app/navigation";
  import firebase from "$lib/firebase.js";
  import { hasPath } from "ramda";
  import * as XLSX from "xlsx";
  import { page } from "$app/stores";
  import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "sveltestrap";
  import MaskInput from "svelte-input-mask/MaskInput.svelte";

  $: currentMosqueId = $currentUser.user?.org?.id;
  $: canEditNotes =
    $currentUser.user?.canEditNotes ||
    isMosqAdmin($currentUser.user) ||
    isUnionAdmin($currentUser.user);

  let mosque = {};

  const mosqueId = $page.params.mosqueId;
  $: if (isUnionAdmin(currentUser) || isSuperAdmin($currentUser.user)) currentMosqueId = mosqueId;

  let activeCalendar = "gregorian"; // "hijri"
  let activeMonth = generateActiveMonth(activeCalendar);
  let activeYear = new Date().getFullYear().toString();

  let hiddenFileInput;

  function handleMonthChange(e) {
    e.preventDefault();
    activeMonth = parseInt(e.target.dataset.value);
  }

  function handleYearChange(e) {
    e.preventDefault();
    activeYear = parseInt(e.target.dataset.value);
  }
  function handleCalendarChange(e) {
    e.preventDefault();
    activeCalendar = e.target.dataset.value;
    activeMonth = generateActiveMonth(activeCalendar);
    activeYear = activeCalendar === "hijri" ? hijriYears[0] : gregorianYears[0];
  }

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
  let gregorianMonths = [
    "",
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
  let hijriMonthsNames = [
    "",
    "Muharram",
    "Safar",
    "Rabi al-Awwal",
    "Rabi al-Thani",
    "Jumada al-Awwal",
    "Jumada al-Thani",
    "Rajab",
    "Shaban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qadah",
    "Dhu al-Hijjah",
  ];
  let availableHijriMonths = {};

  let data = [];
  let hijriYears = [];
  let gregorianYears = [];

  $: if ($currentUser.user) fetchData();

  function fetchData() {
    console.log("fetching data");

    if (
      isMosq($currentUser.user) ||
      isUnionAdmin($currentUser.user) ||
      isSuperAdmin($currentUser.user)
    ) {
      const unsubscribe = firebase
        .database()
        .ref("prayerTimes/" + currentMosqueId)
        .on("value", function (snapshot) {
          if (!snapshot) return;
          const snapData = snapshot.val();
          // console.log("raw data", { data });

          if (snapData && Object.keys(snapData).length) {
            function toHijriDate(date) {
              const dateArr = date.split(".");

              const _day = dateArr[0];
              const _month = dateArr[1];
              const _year = dateArr[2];

              return hMoment(`${_year}-${_month}-${_day}`).format("iDD.iMM.iYYYY");
            }

            let _hijriYears = [];
            let _gregorianYears = [];

            const _availableHijriMonths = {};

            const allDays = Object.entries(snapData).map(([key, value]) => {
              const gregorianDate = value.Date;
              const gregorianDateArr = gregorianDate.split(".");
              const gregorianYear = gregorianDateArr[2];
              if (!_gregorianYears.includes(gregorianYear)) {
                _gregorianYears = [..._gregorianYears, gregorianYear];
              }

              const hijriDate = toHijriDate(value.Date);
              const hijriDateArr = hijriDate.split(".");
              const hijriYear = hijriDateArr[2];
              if (!_hijriYears.includes(hijriYear)) {
                _hijriYears = [..._hijriYears, hijriYear];
              }

              const hijriMonth = hijriDateArr[1];

              if (!_availableHijriMonths[hijriYear]) {
                _availableHijriMonths[hijriYear] = [""];
              }
              if (!_availableHijriMonths[hijriYear].includes(hijriMonth)) {
                _availableHijriMonths[hijriYear] = [
                  ..._availableHijriMonths[hijriYear],
                  hijriMonth,
                ];
              }

              return {
                ...value,
                id: key,
                hijriDate,
              };
            });

            availableHijriMonths = _availableHijriMonths;
            hijriYears = _hijriYears;
            gregorianYears = _gregorianYears;
            activeMonth = generateActiveMonth(activeCalendar);

            data = allDays;

            // console.log({ allDays });
          }
        });

      onDestroy(unsubscribe);
    }

    if (isMosq($currentUser.user)) {
      const unsubscribe = firebase
        .firestore()
        .collection("mosques")
        .doc(currentMosqueId)
        .onSnapshot((snapshot) => {
          const data = snapshot.data();
          mosque = data;
        });

      onDestroy(unsubscribe);
    } else if (mosqueId) {
      if (isUnionAdmin($currentUser.user)) {
        const unsubscribe = firebase
          .firestore()
          .collection("mosques")
          .doc(mosqueId)
          .onSnapshot((snapshot) => {
            const data = snapshot.data();

            if (data.membership?.includes(currentMosqueId)) mosque = data;
          });

        onDestroy(unsubscribe);
      } else if (isSuperAdmin($currentUser.user)) {
        const unsubscribe = firebase
          .firestore()
          .collection("mosques")
          .doc(mosqueId)
          .onSnapshot((snapshot) => {
            const data = snapshot.data();
            mosque = data;
          });

        onDestroy(unsubscribe);
      }
    }
  }

  function generateActiveMonth(_activeCalendar) {
    if (!_activeCalendar) _activeCalendar = activeCalendar;
    if (_activeCalendar === "hijri") {
      // TODO: set current month for hijri years
      return "0";
    } else {
      const today = new Date();
      let currentMonth = today.getMonth() + 1;
      if (currentMonth < 10) currentMonth = "0" + currentMonth.toString();
      else currentMonth = currentMonth.toString();
      return currentMonth;
    }
  }

  let canEditTimes = false;
  let canEditNotes = false;

  $: if ($currentUser.user) setPermissions();

  function setPermissions() {
    if (isMosq($currentUser.user)) {
      if ($currentUser.user.role === "admin") {
        canEditTimes = true;
        if (
          hasPath(["org", "permissions", "publications"])($currentUser.user) &&
          $currentUser.user.org.permissions.publications
        )
          canEditNotes = true;
      } else if ($currentUser.user.role === "publisher") {
        if (!$currentUser.user.canEditPrayerTimes && !$currentUser.user.canEditNotes)
          goto("./no-access");
        if ($currentUser.user.canEditPrayerTimes) canEditTimes = true;
        else canEditTimes = false;
        if ($currentUser.user.canEditNotes) {
          if (
            hasPath(["org", "permissions", "publications"])($currentUser.user) &&
            $currentUser.user.org.permissions.publications
          )
            canEditNotes = true;
        } else canEditNotes = false;
      } else {
        canEditTimes = false;
        canEditNotes = false;
      }
    } else if (isUnionAdmin($currentUser.user) || isSuperAdmin($currentUser.user)) {
      canEditNotes = true;
      canEditTimes = true;
    } else {
      goto("/logout");
    }
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

  function handleExport() {
    const exportData = filteredData.map(([__, values]) => {
      return [
        convertDBDateToString(values.id),
        values.hijriDate,
        $_(getDayFromDate(convertDBDateToDate(values.id))),
        values.Fajr,
        values.Sabah,
        values.Sunrise,
        values.DhuhrTime,
        values.Dhuhr,
        values.Asr,
        values.Maghrib,
        values.IshaTime,
        values.Isha,
      ];
    });
    exportData.unshift([
      "Date",
      "Hijri Date",
      "Day",
      "Fajr",
      "Sabah",
      "Sunrise",
      "DhuhrTime",
      "Dhuhr",
      "Asr",
      "Maghrib",
      "IshaTime",
      "Isha",
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "PrayerTimes");

    const today = new Date();
    let str = formatDateToCustomFormat(today);
    str = str.split(".").join("-");

    let exportName = "";
    if (mosque.Name) {
      const today = new Date();
      let str = formatDateToCustomFormat(today);
      str = str.split(".").join("-");

      exportName = `MyMosq_${$_("PrayerTimes")}_${mosque.Name}-${mosque.Plz}-${mosque.Kanton}`;
      if (activeMonth !== "0" && activeMonth !== 0 && activeMonth !== "") {
        exportName += `_${monthIndexToMonth(Number(activeMonth))}`;
      }
      exportName += "_" + activeYear;
      exportName += "_PrayerTimes.xlsx";
    }

    XLSX.writeFileXLSX(wb, exportName);
  }

  let importSuccessMessage = "";
  let importErrorMessage = "";

  function readExcel(file) {
    importErrorMessage = "";

    const promise = new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.readAsArrayBuffer(file);
      fileReader.onload = (e) => {
        const bufferArray = e.target.result;
        const wb = XLSX.read(bufferArray, { type: "buffer" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const excelData = XLSX.utils.sheet_to_json(ws);

        const unique = excelData
          .reverse()
          .reduce((acc, cur) => {
            const date = validateDate(cur.Date);
            const index = acc.findIndex((x) => {
              const xDate = validateDate(x.Date);
              if (date === xDate) return true;
              else return false;
            });
            if (index >= 0) {
              return acc;
            } else {
              return [...acc, cur];
            }
          }, [])
          .reverse()
          .map((day) => {
            // if (!day.Notes) day.Notes = "";
            return {
              ...day,
              // Notes: notesToDbFormat(day.Notes),
            };
          });
        resolve(renameKeys(unique, Object.keys(data)));
        // console.log(excelData);
        // setData(renameKeys(excelData, Object.keys(data)));
        // setData(excelData);
      };
      fileReader.onerror = (err) => {
        reject(err);
      };
    });

    promise.then(async (d) => {
      try {
        const times = [
          "Asr",
          "Dhuhr",
          "DhuhrTime",
          "Fajr",
          "Isha",
          "IshaTime",
          "Maghrib",
          "Sabah",
          "Sunrise",
        ];
        Object.keys(d).forEach((day) => {
          Object.keys(d[day]).forEach((key) => {
            let val = d[day][key];
            if (times.includes(key)) {
              const validated = validateTime(val);
              if (validated !== false) {
                d[day][key] = validated;
              } else {
                // eslint-disable-next-line

                // eslint-disable-next-line no-throw-literal
                throw `${$_("Date")} ${d[day].Date} ${$_("hasInvaliedTimeOf")} ${key} (${val})`;
              }
            } else if (key === "Date") {
              const validated = validateDate(val);
              if (validated !== false) {
                d[day][key] = validated;
                // eslint-disable-next-line
              } else throw `${$_("Date")} ${val} ${$_("doesNotExists")}!`;
            }
          });
        });
        /* console.log('Object.keys(data) :', Object.keys(data))
          console.log('Object.keys(d). :', Object.keys(d)) */
        let finalData = { ...d };
        console.log("imported data from excel", { d });

        // set imported data
        // Object.keys(d).forEach((item) => {
        //   finalData[item] = d[item];
        // });

        // fix overwritten keys
        const correctedKeys = {};
        Object.entries(finalData).forEach(([_, item]) => {
          const dbKey = item.Date.split(".").reverse().join("");

          correctedKeys[dbKey] = item;
        });
        finalData = { ...correctedKeys };

        console.log("corrected key for imported data", { finalData });

        // merge existing data
        Object.values(data).forEach((item) => {
          const key = item.Date.split(".").reverse().join("");

          if (finalData[key] && item.hasOwnProperty("Notes")) {
            // update note if exists
            finalData[key].Notes = item?.Notes;
          } else if (!finalData[key]) {
            finalData[key] = item;
          }
        });

        /* finalData = Object.keys(finalData).reduce((acc, cur) => {
          const arr = finalData[cur].Date.split('.')
          const key = `${arr[2]}${arr[1]}${arr[0]}`
          return { ...acc, [key]: finalData[cur] }
        }, {}) */
        // console.log('finalData :', finalData)

        // console.log(finalData)

        // fix overwritten day values
        const referenceData = (await firebase.database().ref("prayerTimes/1028").get()).val();
        Object.keys(finalData).forEach((key) => {
          if (referenceData[key]) {
            finalData[key].Day = referenceData[key].Day;
          }

          delete finalData[key].id;
          delete finalData[key].hijriDate;
        });

        console.log("final data being written to database", { finalData });

        const dataRef = firebase.database().ref("prayerTimes/" + currentMosqueId);
        dataRef.set(finalData);

        importSuccessMessage = $_("importSuccess");
        setTimeout(() => {
          importSuccessMessage = "";
        }, 5000);
        // setActiveMonth(generateactiveMonth(activeCalendar));
        // reloadTimes();

        // fetchData();
      } catch (error) {
        console.error(error);
        // setImportError(error);
        importErrorMessage = error;
      }

      // console.log(data);
    });
    // .then((data) => {
    //   console.log(data);
    // });
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

  function formatStrToDate(d) {
    const arr = d.split(".");
    return new Date(arr[2], arr[1] - 1, arr[0]);
  }

  function renameKeys(obj) {
    return Object.keys(obj).reduce((acc, cur) => {
      const date = validateDate(obj[cur].Date);
      const arr = date.split(".");
      const key = `${arr[2]}${arr[1]}${arr[0]}`;
      return { ...acc, [key]: obj[cur] };
    }, {});
  }

  let isSabahModalShown = false;
  let sabahModalFormValues = {
    minutesAfterFajr: "",
    minutesBeforeSunrise: "",
    fixTime: "",
    selectedEditOption: "minutesAfterFajr",
  };
  function toggleSabahModal() {
    isSabahModalShown = !isSabahModalShown;
  }
  let sabahModalErrorMessage = "";
  async function handleSabahEditConfirm() {
    sabahModalErrorMessage = "";

    switch (sabahModalFormValues.selectedEditOption) {
      case "minutesAfterFajr": {
        const minutesAfterFajrString = sabahModalFormValues.minutesAfterFajr.trim();

        if (!minutesAfterFajrString) break;

        const minutesAfterFajr = Number(minutesAfterFajrString);

        if (Number.isNaN(minutesAfterFajr)) break;

        if (minutesAfterFajr > 90 || minutesAfterFajr < 0) {
          sabahModalErrorMessage = "invalid minutes after fajr";
          break;
        }

        // CAUTION: this directly mutates the data object since it is a referenceData
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({ filteredData });

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];
          const momentFajr = moment(day.Fajr, "HH:mm");
          const momentSabah = momentFajr.add(minutesAfterFajr, "minutes");

          day.Sabah = momentSabah.format("HH:mm");

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({ prayerTimes });

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated sabah prayer times after fajr");

        // updatedPrayerTimesNotification();

        break;
      }
      case "minutesBeforeSunrise": {
        const minutesBeforeSunriseString = sabahModalFormValues.minutesBeforeSunrise.trim();

        if (!minutesBeforeSunriseString) break;

        const minutesBeforeSunrise = Number(minutesBeforeSunriseString);

        if (Number.isNaN(minutesBeforeSunrise)) break;

        if (minutesBeforeSunrise > 90 || minutesBeforeSunrise < 0) {
          sabahModalErrorMessage = "invalid minutes before sunrise";
          break;
        }

        // CAUTION: this directly mutates the data object since it is a referenceData
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({filteredData})

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];
          const momentSunrise = moment(day.Sunrise, "HH:mm");
          const momentSabah = momentSunrise.subtract(minutesBeforeSunrise, "minutes");

          day.Sabah = momentSabah.format("HH:mm");

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({prayerTimes})

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated sabah prayer times before sunrise");

        // updatedPrayerTimesNotification();

        break;
      }
      case "fixTime": {
        const isValidTimeStamp = sabahModalFormValues.fixTime.match(
          /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        );

        if (!isValidTimeStamp) {
          sabahModalErrorMessage = "invalid fix times format";
          break;
        }

        // similar to the above code but without any modification and just an absolute value
        // CAUTION: this directly mutates the data object since it is a referenceData
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({filteredData})

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];

          day.Sabah = sabahModalFormValues.fixTime;

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({prayerTimes})

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated sabah prayer times to a fixed time");

        // updatedPrayerTimesNotification();

        break;
      }
      default:
        break;
    }

    sabahModalErrorMessage = "";

    toggleSabahModal();
  }

  let isDhuhrModalShown = false;
  let dhuhrModalFormValues = {
    minutesAfterDhuhr: "",
    fixTimeBefore: "",
    fixTimeAfter: "",
    jumahBefore: "",
    jumahAfter: "",
    selectedEditOption: "minutesAfterDhuhr",
  };
  let dhuhrModalErrorMessage = "";
  function toggleDhuhrModal() {
    isDhuhrModalShown = !isDhuhrModalShown;
  }
  async function handleDhuhrEditConfirm() {
    dhuhrModalErrorMessage = "";
    console.log({ dhuhrModalFormValues });

    switch (dhuhrModalFormValues.selectedEditOption) {
      case "minutesAfterDhuhr": {
        const minutesAfterDhuhrString = dhuhrModalFormValues.minutesAfterDhuhr.trim();

        if (!minutesAfterDhuhrString) break;

        const minutesAfterDhuhr = Number(minutesAfterDhuhrString);

        if (minutesAfterDhuhr > 90 || minutesAfterDhuhr < 0) {
          dhuhrModalErrorMessage = "invalid minutes after Dhuhr";
          break;
        }

        // CAUTION: this directly mutates the data object since it is a referenceData
        // let filteredData = {...data};
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({filteredData})

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];
          const momentDhuhr = moment(day.DhuhrTime, "HH:mm");
          const momentAfterDhuhr = momentDhuhr.add(minutesAfterDhuhr, "minutes");

          day.Dhuhr = momentAfterDhuhr.format("HH:mm");

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({prayerTimes})

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated dhuhr prayer times after dhuhr");

        // updatedPrayerTimesNotification();

        break;
      }
      case "fixTime": {
        const isValidBeforeTimeStamp = dhuhrModalFormValues.fixTimeBefore.match(
          /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        );
        const isValidAfterTimeStamp = dhuhrModalFormValues.fixTimeAfter.match(
          /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        );
        if (!isValidBeforeTimeStamp || !isValidAfterTimeStamp) {
          dhuhrModalErrorMessage = "invalid fix times format";
          break;
        }

        // CAUTION: this directly mutates the data object since it is a referenceData
        // let filteredData = {...data};
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({filteredData})

        const earlierTime = moment.min(
          moment(dhuhrModalFormValues.fixTimeBefore, "HH:mm"),
          moment(dhuhrModalFormValues.fixTimeAfter, "HH:mm")
        );
        const laterTime = moment.max(
          moment(dhuhrModalFormValues.fixTimeBefore, "HH:mm"),
          moment(dhuhrModalFormValues.fixTimeAfter, "HH:mm")
        );

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];
          const momentDhuhrTime = moment(day.DhuhrTime, "HH:mm");

          if (momentDhuhrTime.isBefore(earlierTime) || momentDhuhrTime.isSame(earlierTime)) {
            day.Dhuhr = earlierTime.format("HH:mm");
          } else if (momentDhuhrTime.isBefore(laterTime) || momentDhuhrTime.isSame(laterTime)) {
            day.Dhuhr = laterTime.format("HH:mm");
          } else {
            day.Dhuhr = momentDhuhrTime.format("HH:mm");
          }

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({prayerTimes})

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated dhuhr prayer times after fix times");

        // updatedPrayerTimesNotification();

        break;
      }
      case "fixJumah": {
        const isValidBeforeTimeStamp = dhuhrModalFormValues.jumahBefore.match(
          /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        );
        const isValidAfterTimeStamp = dhuhrModalFormValues.jumahAfter.match(
          /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        );
        if (!isValidBeforeTimeStamp || !isValidAfterTimeStamp) {
          dhuhrModalErrorMessage = "invalid fix times format";
          break;
        }

        // CAUTION: this directly mutates the data object since it is a referenceData
        // let filteredData = {...data};
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({filteredData})

        const earlierTime = moment.min(
          moment(dhuhrModalFormValues.jumahBefore, "HH:mm"),
          moment(dhuhrModalFormValues.jumahAfter, "HH:mm")
        );
        const laterTime = moment.max(
          moment(dhuhrModalFormValues.jumahBefore, "HH:mm"),
          moment(dhuhrModalFormValues.jumahAfter, "HH:mm")
        );

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];

          const isFriday = day.Day === "Fr";
          if (isFriday) {
            const momentDhuhrTime = moment(day.DhuhrTime, "HH:mm");

            if (momentDhuhrTime.isBefore(earlierTime) || momentDhuhrTime.isSame(earlierTime)) {
              day.Dhuhr = earlierTime.format("HH:mm");
            } else if (momentDhuhrTime.isBefore(laterTime) || momentDhuhrTime.isSame(laterTime)) {
              day.Dhuhr = laterTime.format("HH:mm");
            } else {
              day.Dhuhr = momentDhuhrTime.format("HH:mm");
            }
          }

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({prayerTimes})

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated dhuhr prayer times after jumah fix times");

        // updatedPrayerTimesNotification();

        break;
      }
      default:
        break;
    }

    dhuhrModalErrorMessage = "";

    toggleDhuhrModal();
  }

  let isIshaModalShown = false;
  let ishaModalFormValues = {
    minutesAfterIsha: "",
    minimumTime: "",
    selectedEditOption: "minutesAfterIsha",
  };
  let ishaModalErrorMessage = "";
  function toggleIshaModal() {
    isIshaModalShown = !isIshaModalShown;
  }
  async function handleIshaEditConfirm() {
    ishaModalErrorMessage = "";

    switch (ishaModalFormValues.selectedEditOption) {
      case "minutesAfterIsha": {
        const minutesAfterIshaString = ishaModalFormValues.minutesAfterIsha.trim();

        if (!minutesAfterIshaString) break;

        const minutesAfterIsha = Number(minutesAfterIshaString);

        if (minutesAfterIsha > 90 || minutesAfterIsha < 0) {
          ishaModalErrorMessage = "invalid minutes after isha";
          break;
        }

        // CAUTION: this directly mutates the data object since it is a referenceData
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({filteredData})

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];
          const momentIshaTime = moment(day.IshaTime, "HH:mm");
          const momentIsha = momentIshaTime.add(minutesAfterIsha, "minutes");

          day.Isha = momentIsha.format("HH:mm");

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({prayerTimes})

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated isha prayer times after minutes after isha");

        // updatedPrayerTimesNotification();

        break;
      }
      case "minimumTime": {
        const isValidTimestamp = ishaModalFormValues.minimumTime.match(
          /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        );
        if (!isValidTimestamp) {
          ishaModalErrorMessage = "invalid fix times format";
          break;
        }

        // CAUTION: this directly mutates the data object since it is a referenceData
        let filteredData = { ...data };

        // console.log({activeMonth, activeYear})

        activeYear && (filteredData = filterDataByYear(filteredData, Number(activeYear)));
        activeMonth !== "0" &&
          (filteredData = filterDataByMonth(filteredData, Number(activeMonth)));

        // console.log({filteredData})

        const updatedTimes = Object.keys(filteredData).reduce((acc, cur) => {
          const day = filteredData[cur];
          const momentIshaTime = moment(day.IshaTime, "HH:mm");
          const momentMinimumTime = moment(ishaModalFormValues.minimumTime, "HH:mm");

          if (momentMinimumTime.isAfter(momentIshaTime)) {
            day.Isha = momentMinimumTime.format("HH:mm");
          } else {
            day.Isha = day.IshaTime;
          }

          return { ...acc, [cur]: day };
        }, {});

        // console.log({updatedTimes})

        const prayerTimesSnap = await firebase
          .database()
          .ref("prayerTimes/" + currentMosqueId)
          .once("value");
        let prayerTimes = prayerTimesSnap.val();

        prayerTimes = { ...prayerTimes, ...updatedTimes };

        // console.log({prayerTimes})

        const ref = firebase.database().ref(`prayerTimes/${currentMosqueId}`);
        await ref.set(prayerTimes);

        // CAUTION: this directly mutates the data object since it is a referenceData
        // react is not aware of this change
        // filteredData = prayerTimes;
        // setData(filteredData);
        // reloadTimes();
        // fetchData();

        console.log("updated isha prayer times after fix times");

        // updatedPrayerTimesNotification();

        break;
      }
      default:
        break;
    }

    ishaModalErrorMessage = "";
    toggleIshaModal();
  }

  $: filteredData = Object.entries(data)
    .filter(([_, item]) => {
      if (activeMonth !== "" && Number(activeMonth) !== 0 && item.Date && item.hijriDate) {
        let str;
        if (activeCalendar === "hijri") {
          str = item.hijriDate.split(".");
        } else {
          str = item.Date.split(".");
        }

        const month = str[1];

        if (Number(month) === Number(activeMonth)) return true;
        else return false;
      } else return true;
    })
    .filter(([_, item]) => {
      if (activeYear !== "" && item.Date && item.hijriDate) {
        let str;
        if (activeCalendar === "hijri") {
          str = item.hijriDate.split(".");
        } else {
          str = item.Date.split(".");
        }
        const year = str[2];

        if (Number(year) === Number(activeYear)) return true;
        else return false;
      } else return true;
    });

  function getDayFromDate(date) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    return days[date.getDay()];
  }

  function convertDBDateToDate(str = "") {
    const year = parseInt(str.slice(0, 4));
    const month = parseInt(str.slice(4, 6));
    const date = parseInt(str.slice(6));

    const newDate = new Date(year, month - 1, date);

    return newDate;
  }

  function convertDBDateToObj(str = "") {
    const year = parseInt(str.slice(0, 4));
    const month = parseInt(str.slice(4, 6));
    const date = parseInt(str.slice(6));

    return {
      year,
      month,
      date,
    };
  }

  function handleKeyDown(e) {
    const { keyCode, currentTarget } = e;
    let dataName = currentTarget.getAttribute("data-name");
    if (keyCode === 13) {
      // enter
      if (dataName === "Notes") {
        e.preventDefault();
        const nextRow = currentTarget.parentElement.nextElementSibling;
        if (nextRow) nextRow.querySelector('[data-name="Fajr"]').focus();
      } else {
        e.preventDefault();
        currentTarget.nextElementSibling.focus();
      }
    }
  }

  function validateTime(time) {
    if (typeof time === "number" && time < 1) {
      const minutes = time * 1440;
      let hour = Math.floor(minutes / 60);
      if (hour < 10) hour = `0${hour}`;
      let min = Math.round(minutes % 60);
      if (min < 10) min = `0${min}`;
      return `${hour}:${min}`;
    } else {
      const hhmm = new RegExp("^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$");
      if (hhmm.test(time)) {
        return time;
      } else return false;
    }
  }

  async function textChangeHandler(e) {
    // setLoading(true);
    let dataId = e.currentTarget.getAttribute("data-id");
    let dataName = e.currentTarget.getAttribute("data-name");
    let val = e.currentTarget.textContent;
    // if (dataName === "Notes") {
    //   val = notesToDbFormat(val);
    // }

    let query = firebase.database().ref("prayerTimes/" + currentMosqueId + "/" + dataId);

    const original = data.find((item) => item.id === dataId);
    if (original[dataName] !== val) {
      if (dataName === "Notes") {
        query.child(dataName).set(val);
        return;
      }

      try {
        const validated = validateTime(val);
        if (validated === false) {
          throw new Error(`Invalid time: ${val}`);
        }
        query.child(dataName).set(validated);
      } catch (error) {
        // console.error(error);
        // e.target.innerText = data[dataId][dataName];
        e.target.innerText = original[dataName];
      }
    }
  }

  function monthIndexToMonth(index) {
    let i = Number(index);
    if (!i) i = 0;

    let month;

    if (activeCalendar === "hijri") month = $_(hijriMonthsNames[i]);
    else month = $_(gregorianMonths[i]);

    return month;
  }

  function filterDataByYear(data, year) {
    return Object.values(data).reduce((acc, cur) => {
      let date;
      if (activeCalendar === "hijri") {
        date = convertDBDateToObj(cur.hijriDate.split(".").reverse().join(""));
      } else {
        date = convertDBDateToObj(cur.id);
      }
      if (date.year === year) {
        return { ...acc, [cur.id]: cur };
      }

      return acc;
    }, {});
  }

  function filterDataByMonth(data, month) {
    return Object.values(data).reduce((acc, cur) => {
      let date;
      if (activeCalendar === "hijri") {
        date = convertDBDateToObj(cur.hijriDate.split(".").reverse().join(""));
      } else {
        date = convertDBDateToObj(cur.id);
      }
      if (date.month === month || Number(month) === 0) {
        return { ...acc, [cur.id]: cur };
      }

      return acc;
    }, {});
  }
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <div class="custom-menu__item">
      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {$_(activeCalendar)}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          <a
            class="dropdown-item"
            on:click={handleCalendarChange}
            href="#"
            data-value={"gregorian"}
          >
            {$_("gregorian")}
          </a>
          <a class="dropdown-item" on:click={handleCalendarChange} href="#" data-value={"hijri"}>
            {$_("hijri")}
          </a>
        </div>
      </li>
      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {#if activeCalendar === "gregorian"}
            {$_(months[Number(activeMonth)])}
          {:else if activeCalendar === "hijri"}
            {$_(monthIndexToMonth(Number(activeMonth)) || "wholeYear")}
          {/if}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          {#if activeCalendar === "gregorian"}
            {#each gregorianMonths as m, mIndex}
              <a class="dropdown-item" on:click={handleMonthChange} href="#" data-value={mIndex}>
                {$_(monthIndexToMonth(Number(mIndex)) || "wholeYear")}
              </a>
            {/each}
          {:else if activeCalendar === "hijri"}
            {#each availableHijriMonths[activeYear] as mIndex}
              <a
                class="dropdown-item"
                on:click={handleMonthChange}
                href="#"
                data-value={mIndex || 0}
              >
                {$_(monthIndexToMonth(Number(mIndex)) || "wholeYear")}
              </a>
            {/each}
          {/if}
        </div>
      </li>
      <li class="dropdown dropdown-btn dropdown-hover">
        <button class="btn btn-outline-lighten fs-14 fw-400">
          {activeYear}
          &nbsp;
          <img class="svg" alt="" src={"/img/svg/chevron-down.svg"} />
        </button>
        <div class="dropdown-default dropdown-bottomLeft">
          {#if activeCalendar === "gregorian"}
            {#each gregorianYears as year}
              <a class="dropdown-item" on:click={handleYearChange} href="#" data-value={year}>
                {year}
              </a>
            {/each}
          {:else if activeCalendar === "hijri"}
            {#each hijriYears as year}
              <a class="dropdown-item" on:click={handleYearChange} href="#" data-value={year}>
                {year}
              </a>
            {/each}
          {/if}
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

{#if importSuccessMessage}
  <p class="text-success text-center">{importSuccessMessage}</p>
{/if}

{#if importErrorMessage}
  <p class="text-danger text-center">{importErrorMessage}</p>
{/if}

<div class="table-responsive">
  <table class="table table-basic table-borderless">
    <thead>
      <tr>
        <th>{$_("Date")}</th>
        <th>{$_("hijriDate")}</th>
        <th>{$_("day")}</th>
        {#if canEditTimes}
          <th>Fajr</th>
          <th>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span>Sabah</span>
              <span on:click={toggleSabahModal}>
                <Fa icon={faPen} color="#007bff" style="cursor: pointer;" />
              </span>
            </div>
          </th>
          <th>{$_("sunrise")}</th>
          <th>Dhuhr Time</th>
          <th>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span>Dhuhr</span>
              <span on:click={toggleDhuhrModal}>
                <Fa icon={faPen} color="#007bff" style="cursor: pointer;" />
              </span>
            </div>
          </th>
          <th>Asr</th>
          <th>Maghrib</th>
          <th>Isha {$_("time")}</th>
          <th>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span>Isha</span>
              <span on:click={toggleIshaModal}>
                <Fa icon={faPen} color="#007bff" style="cursor: pointer;" />
              </span>
            </div>
          </th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each filteredData as [__, item]}
        <tr id={item.id}>
          <th style={{ cursor: "default", width: "0.1%" }}>{item.Date}</th>
          <td style={{ cursor: "default", width: "0.1%" }}>{item.hijriDate}</td>
          <td style={{ cursor: "default", width: "0.1%" }}>
            {$_(getDayFromDate(convertDBDateToDate(item.id)))}
          </td>
          {#if canEditTimes}
            <td
              data-id={item.id}
              data-name="Fajr"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.Fajr}
            </td>
            <td
              data-id={item.id}
              data-name="Sabah"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.Sabah}
            </td>
            <td
              data-id={item.id}
              data-name="Sunrise"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.Sunrise}
            </td>
            <td
              data-id={item.id}
              data-name="DhuhrTime"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.DhuhrTime}
            </td>
            <td
              data-id={item.id}
              data-name="Dhuhr"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.Dhuhr}
            </td>
            <td
              data-id={item.id}
              data-name="Asr"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.Asr}
            </td>
            <td
              data-id={item.id}
              data-name="Maghrib"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.Maghrib}
            </td>
            <td
              data-id={item.id}
              data-name="IshaTime"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.IshaTime}
            </td>
            <td
              data-id={item.id}
              data-name="Isha"
              contentEditable
              suppressContentEditableWarning
              on:keydown={handleKeyDown}
              on:blur={(e) => {
                textChangeHandler(e);
              }}
            >
              {item.Isha}
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<Modal isOpen={isSabahModalShown} toggle={toggleSabahModal}>
  <ModalHeader toggle={toggleSabahModal}>
    {monthIndexToMonth(activeMonth)}
    {activeYear}
  </ModalHeader>
  <ModalBody>
    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (sabahModalFormValues.selectedEditOption = "minutesAfterFajr")}
          checked={sabahModalFormValues.selectedEditOption === "minutesAfterFajr"}
        />
        <span>
          {$_("Sabah")} = {$_("Fajr")} +{" "}
        </span>
      </label>

      <div class="input-field">
        <input
          type="text"
          name="minutesAfterFajr"
          bind:value={sabahModalFormValues.minutesAfterFajr}
          placeholder="0-90"
        />
        <span>min</span>
      </div>
    </div>

    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (sabahModalFormValues.selectedEditOption = "minutesBeforeSunrise")}
          checked={sabahModalFormValues.selectedEditOption === "minutesBeforeSunrise"}
        />
        <span>
          {$_("Sabah")} = {$_("sunrise")} -{" "}
        </span>
      </label>

      <div class="input-field">
        <input
          type="text"
          name="minutesBeforeSunrise"
          autocomplete="off"
          bind:value={sabahModalFormValues.minutesBeforeSunrise}
          placeholder="0-90"
        />
        <span>min</span>
      </div>
    </div>

    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (sabahModalFormValues.selectedEditOption = "fixTime")}
          checked={sabahModalFormValues.selectedEditOption === "fixTime"}
        />
        <span>
          {$_("fix")}
          {$_("time")}
        </span>
      </label>

      <div class="input-field">
        <MaskInput
          type="text"
          name="fixTime"
          autocomplete="off"
          on:change={(e) => (sabahModalFormValues.fixTime = e.detail.inputState.maskedValue)}
          maskString="hh:mm"
          mask="00:00"
          placeholder="hh:mm"
        />
      </div>
    </div>

    {#if sabahModalErrorMessage}
      <span class="text-center text-danger">{sabahModalErrorMessage}</span>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button color="dark" on:click={toggleSabahModal}>{$_("cancel")}</Button>
    <Button color="primary" on:click={handleSabahEditConfirm}>{$_("Confirm")}</Button>
  </ModalFooter>
</Modal>

<Modal isOpen={isDhuhrModalShown} toggle={toggleDhuhrModal}>
  <ModalHeader toggle={toggleDhuhrModal}>
    {monthIndexToMonth(activeMonth)}
    {activeYear}
  </ModalHeader>
  <ModalBody>
    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (dhuhrModalFormValues.selectedEditOption = "minutesAfterDhuhr")}
          checked={dhuhrModalFormValues.selectedEditOption === "minutesAfterDhuhr"}
        />
        <span>
          {$_("Dhuhr")} = {$_("Dhuhr")}
          {$_("time")} +
        </span>
      </label>

      <div class="input-field">
        <input
          type="text"
          name="minutesAfterDhuhr"
          bind:value={dhuhrModalFormValues.minutesAfterDhuhr}
          placeholder="0-90"
        />
        <span>min</span>
      </div>
    </div>

    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (dhuhrModalFormValues.selectedEditOption = "fixTime")}
          checked={dhuhrModalFormValues.selectedEditOption === "fixTime"}
        />
        <span>
          {$_("Dhuhr")} = {$_("fix")}
        </span>
      </label>

      <div class="input-field">
        <MaskInput
          type="text"
          name="fixTimeBefore"
          autocomplete="off"
          on:change={(e) => (dhuhrModalFormValues.fixTimeBefore = e.detail.inputState.maskedValue)}
          maskString="hh:mm"
          mask="00:00"
          placeholder="hh:mm"
        />

        /

        <MaskInput
          type="text"
          name="fixTimeAfter"
          autocomplete="off"
          on:change={(e) => (dhuhrModalFormValues.fixTimeAfter = e.detail.inputState.maskedValue)}
          maskString="hh:mm"
          mask="00:00"
          placeholder="hh:mm"
        />
      </div>
    </div>

    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (dhuhrModalFormValues.selectedEditOption = "fixJumah")}
          checked={dhuhrModalFormValues.selectedEditOption === "fixJumah"}
        />
        <span>
          {$_("Jumah")} = {$_("fix")}
        </span>
      </label>

      <div class="input-field">
        <MaskInput
          type="text"
          name="jumahBefore"
          autocomplete="off"
          on:change={(e) => (dhuhrModalFormValues.jumahBefore = e.detail.inputState.maskedValue)}
          maskString="hh:mm"
          mask="00:00"
          placeholder="hh:mm"
        />

        /

        <MaskInput
          type="text"
          name="jumahAfter"
          autocomplete="off"
          on:change={(e) => (dhuhrModalFormValues.jumahAfter = e.detail.inputState.maskedValue)}
          maskString="hh:mm"
          mask="00:00"
          placeholder="hh:mm"
        />
      </div>
    </div>

    {#if dhuhrModalErrorMessage}
      <span class="text-center text-danger">{dhuhrModalErrorMessage}</span>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button color="dark" on:click={toggleDhuhrModal}>{$_("cancel")}</Button>
    <Button color="primary" on:click={handleDhuhrEditConfirm}>{$_("Confirm")}</Button>
  </ModalFooter>
</Modal>

<Modal isOpen={isIshaModalShown} toggle={toggleIshaModal}>
  <ModalHeader toggle={toggleIshaModal}>
    {monthIndexToMonth(activeMonth)}
    {activeYear}
  </ModalHeader>
  <ModalBody>
    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (ishaModalFormValues.selectedEditOption = "minutesAfterIsha")}
          checked={ishaModalFormValues.selectedEditOption === "minutesAfterIsha"}
        />
        <span>
          {$_("Isha")} = {$_("Isha")}
          {$_("time")} +
        </span>
      </label>

      <div class="input-field">
        <input
          type="text"
          name="minutesAfterIsha"
          bind:value={ishaModalFormValues.minutesAfterIsha}
          placeholder="0-90"
        />
        <span>min</span>
      </div>
    </div>

    <div class="input-row">
      <label class="input-label">
        <input
          type="radio"
          name="selectedEditOption"
          on:click={() => (ishaModalFormValues.selectedEditOption = "minimumTime")}
          checked={ishaModalFormValues.selectedEditOption === "minimumTime"}
        />
        <span>
          {$_("fix")}
          {$_("time")}
        </span>
      </label>

      <div class="input-field">
        <MaskInput
          type="text"
          name="minimumTime"
          autocomplete="off"
          on:change={(e) => (ishaModalFormValues.minimumTime = e.detail.inputState.maskedValue)}
          maskString="hh:mm"
          mask="00:00"
          placeholder="hh:mm"
        />
      </div>
    </div>

    {#if ishaModalErrorMessage}
      <span class="text-center text-danger">{ishaModalErrorMessage}</span>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button color="dark" on:click={toggleIshaModal}>{$_("cancel")}</Button>
    <Button color="primary" on:click={handleIshaEditConfirm}>{$_("Confirm")}</Button>
  </ModalFooter>
</Modal>

<style>
  .actions-menu {
    @media (max-width: 768px) {
      flex-direction: column-reverse;
      align-items: center;
      gap: 1rem;
    }
  }

  .input-row {
    display: flex;
    margin-bottom: 0.2rem;

    @media (max-width: 768px) {
      margin: 1rem 0;
    }
  }

  .input-label {
    flex: 1;
  }

  .input-field {
    flex: 2;
  }

  @media (max-width: 768px) {
    .input-label {
      flex: 2;
    }

    .input-field {
      flex: 1;
    }
  }

  tr:nth-child(even),
  tr:nth-child(even) td {
    background-color: #f2f2f2;
  }
</style>
