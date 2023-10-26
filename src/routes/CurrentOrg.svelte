<script>
  import { currentUser } from "$lib/store/currentUser.js";
</script>

{#if $currentUser.user?.org?.type === "mosque"}
  <div style="color: #21BA45" class="current-org-text">
    {$currentUser.user?.org?.Name || ""} / {$currentUser.user?.org?.Ort || ""}{" "}
    {$currentUser.user?.org?.Kanton || ""}
  </div>
{:else}
  <div style={{ color: "#21BA45" }} class="current-org-text">
    {$currentUser.user?.org?.Shortname || ""}
  </div>
{/if}
