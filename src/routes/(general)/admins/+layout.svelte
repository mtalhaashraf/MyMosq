<script>
  import { checkPageVisitPermsOrRedirect } from "@utility/helpers.js";
  import { currentUser } from "$lib/store/currentUser.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  $: if ($currentUser.user && $page.url.toString() !== "/logout")
    checkPageVisitPermsOrRedirect($currentUser.user, ["superadmin"], goto);
</script>

<slot />
