<script>
  import { checkPageVisitPermsOrRedirect } from "@utility/helpers.js";
  import { currentUser } from "$lib/store/currentUser.js";
  import { goto } from "$app/navigation";

  $: if ($currentUser.user)
    checkPageVisitPermsOrRedirect(
      $currentUser.user,
      ["admin", "mosque", "publisher", "union"],
      goto
    );
</script>

<slot />
