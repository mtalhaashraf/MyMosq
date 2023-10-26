<script>
  import MosquePosts from "./MosquePosts.svelte";
  import { currentUser } from "$lib/store/currentUser.js";
  import {
    isMosq,
    isMosqAdmin,
    isMosqPublisher,
    isUnion,
    isUnionAdmin,
  } from "$lib/utility/helpers.js";
  import UnionPosts from "./UnionPosts.svelte";
</script>

{#if $currentUser.user}
  {#if isMosq($currentUser.user) || isMosqAdmin($currentUser.user) || isMosqPublisher($currentUser.user)}
    <MosquePosts />
  {:else if isUnion($currentUser.user) || isUnionAdmin($currentUser.user)}
    <UnionPosts />
  {/if}
{/if}
