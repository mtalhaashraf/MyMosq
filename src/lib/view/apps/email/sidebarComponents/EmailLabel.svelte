<script>
  export let labelList;
</script>

<ul class="dm-mail-label-list mt-0">
  {#each labelList as { text }, i}
    <li>
      <a href="/"><i class="uil uil-list-ul" />{text}</a>
    </li>
  {/each}
  <li />
</ul>
