<script>
  import Quill from "quill";
  import "$lib/styles/quill.snow.css";
  import { goto } from "$app/navigation";
  import Fa from "svelte-fa";
  import { faTrash, faSpinner } from "@fortawesome/free-solid-svg-icons";
  import firebase, { firestore } from "$lib/firebase.js";
  import { Card, CardBody, Form, FormGroup, Input, Label, Button } from "sveltestrap";
  import ImagesInput from "$lib/components/ImagesInput.svelte";
  import { currentUser } from "$lib/store/currentUser.js";
  import moment from "moment";
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import { v4 as uuidv4 } from "uuid";

  export let data;

  const id = data.postId;

  let message = null;
  let loading = false;
  let topics = [];
  let file = null;
  let image = null;
  let files = [];
  let images = [];
  let updateTimestamp = false;
  let post = {
    title: "",
    topicId: "",
    sendNotification: false,
    scheduled: false,
    scheduleDate: "",
  };
  let errors = {
    title: [],
    scheduleDate: [],
  };

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
    const res = {
      editorEmail: $currentUser.user.email,
      body: JSON.stringify(delta),
      updatedAt: firestore.Timestamp.now(),
    };

    const scheduleDate = post.scheduleDate;
    delete post.scheduleDate;

    res.draft = type === "draft" || type === "scheduled";
    res.scheduled = type === "scheduled";

    try {
      if (image && image.delete) {
        await deleteImage(id);
        res.imgUrl = null;
      }
      if (image && image.add && !image.delete && file) {
        const url = await saveImage(id);
        res.imgUrl = url;
      }
    } catch (error) {
      // console.log("~ error", error);
    }
    if (updateTimestamp) {
      res.createdAt = firestore.Timestamp.now();
    }
    try {
      await deleteImages(id);
      if (images.length > 0) {
        const oldImages = images.filter((x) => !x.pointer && !x.delete).map((x) => x.url);
        const saveRes = await saveImages(id);
        const newImages = images
          .filter((x) => x.add && !x.delete)
          .map((x, i) => {
            if (saveRes[i]) return saveRes[i];
            return x.url;
          });
        res.images = [...oldImages, ...newImages];
      }
    } catch (error) {
      // console.log("~ error", error);
    }
    if (isValid || type === "draft") {
      await firebase
        .firestore()
        .collection("posts")
        .doc(id)
        .update({
          ...post,
          ...res,
        });

      if (type === "scheduled") {
        await firebase
          .firestore()
          .collection("scheduledPosts")
          .where("postId", "==", id)
          .get()
          .then((querySnapshot) => {
            let updated = 0;

            querySnapshot.forEach(async (doc) => {
              const date = new Date(scheduleDate);
              const scheduledTime = firestore.Timestamp.fromDate(date);

              updated++;

              await firebase.firestore().collection("scheduledPosts").doc(doc.id).set(
                {
                  scheduledTime,
                },
                { merge: true }
              );
            });

            if (updated === 0) {
              const date = new Date(scheduleDate);
              const scheduledTime = firestore.Timestamp.fromDate(date);

              firebase.firestore().collection("scheduledPosts").add({
                postId: id,
                scheduledTime,
              });
            }
          });
      } else {
        await firebase
          .firestore()
          .collection("scheduledPosts")
          .where("postId", "==", id)
          .get()
          .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
              firebase.firestore().collection("scheduledPosts").doc(doc.id).delete();
            });
          });
      }

      message = {
        variant: "success",
        text: $_("postUpdateSuccess"),
      };
      loading = false;
    }
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
      add: true,
    };
    file = localFile;
    image = localImage;
  }

  function handleImageDelete() {
    file = null;
    image.delete = true;
  }

  function saveImage(id) {
    const fileRef = firebase
      .storage()
      .ref()
      .child(`images/post/${post.mosqueId}/${id}/${image.id}.${image.ext}`);
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
            .child(`images/post/${post.mosqueId}/${id}/${image.id}.${image.ext}`);
          return fileRef
            .put(files[image.pointer[0]][image.pointer[1]])
            .then(() => fileRef.getDownloadURL())
            .catch((err) => err);
        })
    );
  }

  function deleteImage(id) {
    return firebase
      .storage()
      .ref()
      .child(`images/post/${post.mosqueId}/${id}/${image.id}.${image.ext}`)
      .delete();
  }

  function deleteImages(id) {
    images
      .filter((x) => x.delete && !x.pointer)
      .map((img) => {
        return firebase
          .storage()
          .ref()
          .child(`images/post/${post.mosqueId}/${id}/${img.id}.${img.ext}`)
          .delete();
      });
  }

  onMount(() => {
    firebase
      .firestore()
      .collection("posts")
      .doc(id)
      .get()
      .then(async (doc) => {
        const data = doc.data();

        if (data.scheduled) {
          await firebase
            .firestore()
            .collection("scheduledPosts")
            .where("postId", "==", id)
            .get()
            .then((querySnapshot) => {
              querySnapshot.forEach((doc) => {
                const scheduledPostData = doc.data();
                const date = moment(scheduledPostData.scheduledTime.toDate())
                  .toISOString(true)
                  .split(".")[0];

                data.scheduleDate = date;
              });
            });
        }

        if (quillInstance) quillInstance.setContents(JSON.parse(data.body));
        post = { ...data, sendNotification: false };
        if (data.imgUrl) {
          const arr = data.imgUrl.split(`${doc.id}%2F`);
          const nameWithExt = arr[1].split("?")[0];
          const id = nameWithExt.split(".")[0];
          const ext = nameWithExt.split(".")[1];
          image = {
            id,
            url: data.imgUrl,
            ext,
          };
        }
        if (Array.isArray(data.images)) {
          const _images = data.images.map((x) => {
            const arr = x.split(`${doc.id}%2F`);
            const nameWithExt = arr[1].split("?")[0];
            const id = nameWithExt.split(".")[0];
            const ext = nameWithExt.split(".")[1];
            return {
              id,
              url: x,
              ext,
            };
          });
          images = _images;
        }
      })
      .catch(console.error);
  });

  $: if ($currentUser.user && post) getTopicsData();

  async function getTopicsData() {
    console.log("getting topics data");

    let ref;
    if ($currentUser.user.role === "admin") {
      if ($currentUser.user.org.type === "union" && post.org) {
        if (post.org.id === $currentUser.user.org.id) {
          ref = firebase
            .firestore()
            .collection("topics")
            .where("org.id", "==", $currentUser.user.org.id);
        } else {
          goto("/no-access");
        }
      } else if (post.mosqueId) {
        if (post.mosqueId === $currentUser.user.mosqueId) {
          ref = firebase
            .firestore()
            .collection("topics")
            .where("mosqueId", "==", $currentUser.user.mosqueId);
        } else {
          goto("/no-access");
        }
      }
    } else {
      if (post.topicId) {
        if ($currentUser.user.topics.includes(post.topicId)) {
          ref = firebase
            .firestore()
            .collection("topics")
            .where("org.id", "==", $currentUser.user.org.id)
            .where(firestore.FieldPath.documentId(), "in", $currentUser.user.topics);
        } else goto("/no-access");
      }
    }

    if (!ref) return;

    return ref.onSnapshot((snapshot) => {
      const arr = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
        };
      });

      topics = arr;
    });
  }

  $: console.log({ post, topics });
  $: console.log(topics.find((x) => x.id === post.topicId));
</script>

<div class="menu-wrapper" style="margin-bottom: 1rem">
  <ul
    class="custom-menu menu-top menu-horizontal actions-menu"
    style="display: flex; justify-content: space-between; align-items: center; padding: 1rem"
  >
    <div class="custom-menu__item" style="display: flex; align-items: center; gap: 1rem;">
      <h5>{$_("editPost")}</h5>
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
            <Input
              type="select"
              bind:value={post.topicId}
              class="form-control px-15 ih-medium"
              id="topic-select"
              valid={post.topicId}
            >
              {#each topics as topic}
                <option value={topic.id} selected={topic.id === post.topicId}>
                  {topic.name}
                </option>
              {/each}
            </Input>
          </div>
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
            label={$_("updateTimestamp")}
            bind:checked={updateTimestamp}
          />
        </FormGroup>

        <FormGroup>
          <Label>
            {$_("featuredImage")}
          </Label>

          {#if image && !image.delete}
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
