<script>
  import { onMount } from "svelte";
  import { _, locale } from "svelte-i18n";

  const localeToFlag = {
    en: "GB",
    de: "DE",
    fr: "FR",
  };

  function handleClick(e) {
    const lang = e.target.dataset.value;

    localStorage.setItem("lang", lang);
    locale.set(lang);
  }
</script>

<div class="dropdown-custom">
  <a href={"#"} class="nav-item-toggle"
    ><img
      src={`https://flagsapi.com/${localeToFlag[$locale] || "GB"}/flat/64.png`}
      alt=""
      class="rounded-circle"
    /></a
  >
  <div class="dropdown-parent-wrapper">
    <div class="dropdown-wrapper dropdown-wrapper--small">
      <a on:click|preventDefault={handleClick} href={"#"} data-value="en"
        ><img src="https://flagsapi.com/GB/flat/64.png" alt="" /> EN</a
      >
      <a on:click|preventDefault={handleClick} href={"#"} data-value="de"
        ><img src="https://flagsapi.com/DE/flat/64.png" alt="" /> DE</a
      >
      <a on:click|preventDefault={handleClick} href={"#"} data-value="fr"
        ><img src="https://flagsapi.com/FR/flat/64.png" alt="" /> FR</a
      >
    </div>
  </div>
</div>
