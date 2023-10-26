<script>
  import MosqueStats from "./MosqueStats.svelte";
  import UnionStats from "./UnionStats.svelte";
  import { currentUser } from "$lib/store/currentUser.js";
</script>

{#if $currentUser.user?.org?.type === "mosque"}
  <MosqueStats />
{:else if $currentUser.user?.org?.type === "union"}
  <UnionStats />
{/if}
