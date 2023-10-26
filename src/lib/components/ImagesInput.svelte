<script>
  import { v4 as uuidv4 } from "uuid";
  import { faTrash } from "@fortawesome/free-solid-svg-icons";
  import Fa from "svelte-fa";
  import { _ } from "svelte-i18n";
  import { FormGroup, Label, Input, Button } from "sveltestrap";

  export let label;
  export let images;
  export let files;

  function handleImagesUpload(e) {
    let index = 0;
    if (Array.isArray(files)) index = files.length;
    const { target } = e;
    const localFiles = target.files;
    const arr = Array.from(localFiles);
    const localImages = arr.map((localFile, i) => {
      const name = localFile.name;
      const lastDot = name.lastIndexOf(".");
      const fileName = name.substring(0, lastDot);
      const ext = name.substring(lastDot + 1);
      return {
        id: uuidv4(),
        url: URL.createObjectURL(localFile),
        pointer: [index, i],
        ext: ext,
        alt: fileName,
        add: true,
      };
    });

    if (files) {
      files = [...files, localFiles];
    } else {
      files = [localFiles];
    }

    images = [...images, ...localImages];
  }

  function handleImagesDelete(id) {
    const _images = images.map((x) => {
      if (x.id === id) {
        return {
          ...x,
          delete: true,
        };
      }
      return x;
    });
    images = _images;
  }

  $: filteredImages = images.filter((x) => !x.delete);
</script>

<FormGroup style="margin-bottom: 1rem;">
  <Label>
    {label}
  </Label>

  {#if Array.isArray(images) && images.filter((x) => !x.delete).length > 0}
    <div class="gallery" style="display: flex; gap: 1rem; margin-bottom: 1rem;">
      {#each filteredImages as image}
        <div data-id={image.id}>
          <img
            src={image.url}
            alt={image.alt}
            style="height: 150px; object-fit: cover; display: block;"
          />
          <Button
            on:click={() => handleImagesDelete(image.id)}
            color="primary"
            class="radius-xs fs-15 fw-400 text-capitalize w-full btn-icon"
            style="width: 100%"
          >
            <Fa icon={faTrash} size="lg" />
          </Button>
        </div>
      {/each}
    </div>
  {/if}

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
  />
</FormGroup>
