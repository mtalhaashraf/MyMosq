<script>
  import "$lib/styles/quill.snow.css";
  import Quill from "quill";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import firebase, { firestore } from "$lib/firebase.js";
  import { currentUser } from "$lib/store/currentUser.js";
  import { v4 as uuidv4 } from "uuid";
  import { _ } from "svelte-i18n";
  import Fa from "svelte-fa";
  import { faTrash, faSpinner } from "@fortawesome/free-solid-svg-icons";
  import { Card, CardBody, Form, FormGroup, Input, Label, Button } from "sveltestrap";
  import ImagesInput from "$lib/components/ImagesInput.svelte";
  import { isUnionAdmin } from "@utility/helpers.js";

  let loading = false;

  let image = null;
  let images = [];

  let file = null;
  let files = [];

  let post = {
    title: "",
    topicId: "",
    sendNotification: true,
    schedulePost: false,
    scheduleDate: "",
  };

  let topics = [];

  let errors = { title: [], scheduleDate: [] };

  $: console.log({ post, errors, loading, image, images, file, files });

  const quillOptions = {
    theme: "snow", // "bubble"
    modules: {
      toolbar: [
        ["bold", "italic", "underline"],
        ["blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ indent: "-1" }, { indent: "+1" }],
        [{ size: ["small", false, "large", "huge"] }],
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ["link"],
        ["video"],
        ["clean"], // remove formatting button
      ],
    },
    formats: [
      "bold",
      "italic",
      "underline",
      "align",
      "list",
      "indent",
      "size",
      "link",
      "color",
      "background",
      "blockquote",
      "header",
      "video",
      "clean",
    ],
  };

  let quillElement;
  let quillInstance;

  onMount(() => {
    quillInstance = new Quill(quillElement, quillOptions);
  });

  function validateForm(e) {
    const requiredFields = document.querySelectorAll("#add-post-form input[required]");
    const requiredFieldsArr = Array.prototype.slice.call(requiredFields);
    const localErrors = requiredFieldsArr.reduce((acc, field) => {
      let tmpErrors;
      tmpErrors = validateField({ target: field }, true);
      return { ...acc, [field.name]: tmpErrors };
    }, {});
    const hasErrors = Object.keys(localErrors).find((error) => localErrors[error].length > 0);
    if (hasErrors) {
      errors = { ...localErrors };
      return false;
    } else return true;
  }

  function validateField(e, multiple) {
    const { name, value, type } = e.target;
    const tmpErrors = [];
    if (value.length === 0) {
      tmpErrors.push($_("errors.cantBeEmpty"));
    }
    if (type === "datetime-local") {
      const date = new Date(value);
      const now = new Date();
      if (date < now) {
        tmpErrors.push($_("cantBeInThePast"));
      }
    }
    if (!multiple) {
      errors = { ...errors, [name]: tmpErrors };
    }
    return tmpErrors;
  }

  async function handleSubmit(e, type) {
    loading = true;

    const isValid = validateForm(e);
    const delta = quillInstance.getContents();
    const ref = firebase.firestore().collection("posts").doc();
    const id = ref.id;
    const res = {
      ...post,
      body: JSON.stringify(delta),
      authorEmail: $currentUser.user.email,
      editorEmail: $currentUser.user.email,
      createdAt: firestore.Timestamp.now(),
      updatedAt: firestore.Timestamp.now(),
      url: `mymosq.com/post/${id}`,
      org: {
        id: $currentUser.user.org.id,
      },
    };

    if (isUnionAdmin($currentUser.user)) {
      res.org.type = "union";
    } else {
      res.mosqueId = $currentUser.user.org.id;
      res.org.type = "mosque";
    }

    console.log(res);

    // these are to be used by the scheduledPosts collection
    delete res.schedulePost;
    delete res.scheduleDate;

    res.draft = type === "draft" || type === "scheduled";
    res.scheduled = type === "scheduled";

    if (!isValid && type !== "draft") {
      loading = false;
      return;
    }

    if (image && file) {
      const url = await saveImage(id);
      res.imgUrl = url;
    }
    if (Array.isArray(images) && images.length > 0) {
      res.images = await saveImages(id);
    }

    firebase
      .firestore()
      .collection("posts")
      .doc(id)
      .set(res)
      .then(() => {
        if (post.schedulePost) {
          const date = new Date(post.scheduleDate);
          const scheduledTime = firestore.Timestamp.fromDate(date);

          firebase.firestore().collection("scheduledPosts").add({
            postId: id,
            scheduledTime,
          });
        }

        loading = false;
        goto(`/posts/${id}`);
      });
  }

  function saveImage(id) {
    const fileRef = firebase
      .storage()
      .ref()
      .child(`images/post/${$currentUser.user.org.id}/${id}/${image.id}.${image.ext}`);
    return fileRef
      .put(file)
      .then(() => fileRef.getDownloadURL())
      .catch((err) => err);
  }

  function saveImages(id) {
    return Promise.all(
      images
        .filter((x) => !x.delete && x.add)
        .map((image) => {
          const fileRef = firebase
            .storage()
            .ref()
            .child(`images/post/${$currentUser.user.org.id}/${id}/${image.id}.${image.ext}`);
          return fileRef
            .put(files[image.pointer[0]][image.pointer[1]])
            .then(() => fileRef.getDownloadURL())
            .catch((err) => err);
        })
    );
  }

  function changeTopic(e) {
    const { value } = e.target;
    post.topicId = value;
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    post[name] = value;
  }

  function handleCheckboxChange(e) {
    const { name, checked } = e.target;
    post[name] = checked;
  }

  function handleImageUpload(e) {
    const { target } = e;
    const localFile = target.files[0];
    const name = localFile.name;
    const lastDot = name.lastIndexOf(".");
    const fileName = name.substring(0, lastDot);
    const ext = name.substring(lastDot + 1);
    const localImage = {
      id: uuidv4(),
      url: URL.createObjectURL(localFile),
      ext: ext,
      alt: fileName,
    };
    file = localFile;
    image = localImage;
  }

  function handleImageDelete() {
    console.log("deleting");

    file = null;
    image = null;
  }

  $: if ($currentUser.user) getData();

  function getData() {
    console.log("fetching data");

    let ref;
    if ($currentUser.user.role === "admin") {
      ref = firebase
        .firestore()
        .collection("topics")
        .where("org.id", "==", $currentUser.user.org.id);
    } else {
      ref = firebase
        .firestore()
        .collection("topics")
        .where("org.id", "==", $currentUser.user.org.id)
        .where(firestore.FieldPath.documentId(), "in", $currentUser.user.topics);
    }

    return ref.onSnapshot((snapshot) => {
      const arr = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        };
      });
      if ($currentUser.user != null) {
        topics = arr;
        const index = arr.findIndex((topic) => topic.name === "general");
        if (index >= 0) post.topicId = arr[index].id;
        else post.topicId = arr[0].id;
      }
    });
  }
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <div class="custom-menu__item" style="display: flex; align-items: center; gap: 1rem;">
      <h5>{$_("newPost")}</h5>
    </div>

    <div class="custom-menu__item">
      <a href="/posts">
        <Button
          color="primary"
          class="btn-default btn-squared radius-xs fs-15 fw-400 text-capitalize"
        >
          {$_("back")}
        </Button>
      </a>
    </div>
  </ul>
</div>

<Card class="card-Vertical card-default card-md mb-4">
  <CardBody class="pb-md-30">
    <div class="Vertical-form">
      <Form>
        <FormGroup>
          <Label for="postTitleInput" class="color-dark fs-14 fw-500 align-center mb-10">
            {$_("title")}
          </Label>
          <Input
            type="text"
            class="form-control ih-medium ip-gray radius-xs b-light px-15"
            id="postTitleInput"
            bind:value={post.title}
            placeholder={$_("title")}
            valid={post.title && errors.title.length === 0}
            on:blur={validateField}
            on:input={validateField}
            required
          />
          {#if errors.title.length === 0}
            <div class="invalid-feedback">
              {errors.title[0]}
            </div>
          {/if}
        </FormGroup>

        <FormGroup>
          <Label for="topic-select" class="il-gray fs-14 fw-500 align-center mb-10">
            {$_("topic")}
          </Label>
          <div class="dm-select">
            <select
              bind:value={post.topicId}
              class="form-control px-15 ih-medium"
              id="topic-select"
            >
              {#each topics as topic}
                <option value={topic.id}>
                  {topic.name}
                </option>
              {/each}
            </select>
          </div>
        </FormGroup>

        <FormGroup>
          <Input
            class="checkbox"
            type="checkbox"
            label={$_("sendNotification")}
            bind:checked={post.sendNotification}
          />
        </FormGroup>

        <FormGroup>
          <Input
            class="checkbox"
            type="checkbox"
            label={$_("schedulePost")}
            bind:checked={post.schedulePost}
          />
        </FormGroup>

        {#if post.schedulePost}
          <FormGroup>
            <Label for="postTitleInput" class="color-dark fs-14 fw-500 align-center mb-10">
              {$_("schedulePost")}
            </Label>
            <Input
              type="datetime-local"
              name="scheduleDate"
              class="form-control ih-medium ip-gray radius-xs b-light px-15"
              id="postTitleInput"
              bind:value={post.scheduleDate}
              placeholder={$_("title")}
              on:input={validateField}
              min={new Date().toISOString().split(".")[0]}
              valid={post.scheduleDate && errors.scheduleDate.length === 0}
              required
            />
            {#if errors.scheduleDate.length === 0}
              <div class="invalid-feedback">
                {errors.scheduleDate[0]}
              </div>
            {/if}
          </FormGroup>
        {/if}

        <FormGroup>
          <Label>
            {$_("featuredImage")}
          </Label>

          {#if image}
            <div style="height: 150px; display: flex; align-items: flex-end; gap: 1rem;">
              <img src={image.url} alt={image.alt} style="height: 100%; object-fit: cover" />
              <Button
                on:click={handleImageDelete}
                color="primary"
                class="radius-xs fs-15 fw-400 text-capitalize btn-squared btn-icon"
              >
                <Fa icon={faTrash} size="lg" />
              </Button>
            </div>
          {:else}
            <Button>
              <Label for="featuredImageInput" style="margin: 0; cursor: pointer;">
                {$_("addImage")}
              </Label>
            </Button>

            <Input
              id="featuredImageInput"
              type="file"
              accept="image/*"
              on:change={handleImageUpload}
              style="display: none"
            />
          {/if}
        </FormGroup>

        <ImagesInput label={$_("additionalImages")} bind:files bind:images />

        <div bind:this={quillElement} style="height: 300px;" />

        <div class="mt-25" style="display: flex;">
          {#if post.schedulePost && !loading}
            <Button color="primary" style="flex: 1;" on:click={(e) => handleSubmit(e, "scheduled")}>
              {$_("schedulePost")}
            </Button>
          {/if}

          {#if !post.schedulePost && !loading}
            <Button color="light" style="flex: 1;" on:click={(e) => handleSubmit(e, "draft")}>
              {$_("saveDraft")}
            </Button>
            <Button color="primary" style="flex: 1;" on:click={handleSubmit}>
              {$_("publishPost")}
            </Button>
          {/if}

          {#if loading}
            <Button color="primary" style="flex: 1;" disabled>
              <Fa icon={faSpinner} spin />
            </Button>
          {/if}
        </div>
      </Form>
    </div>
  </CardBody>
</Card>
