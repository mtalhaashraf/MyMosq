<script>
  import { _ } from "svelte-i18n";
  import { currentUser } from "$lib/store/currentUser.js";
  import { goto } from "$app/navigation";
  import {
    Button,
    Card,
    CardBody,
    CardHeader,
    Col,
    Container,
    FormGroup,
    Input,
    Label,
    Alert,
    Row,
  } from "sveltestrap";
  import firebase, { auth } from "$lib/firebase.js";

  let message = {};
  let loading = false;
  let publisher = { email: "", password: "" };

  function handleSubmit() {
    loading = true;

    firebase
      .firestore()
      .collection("users")
      .where("mosqueId", "==", $currentUser.user.mosqueId)
      .where("role", "==", "publisher")
      .get()
      .then((docs) => {
        if (docs.docs.length <= 10) {
          auth
            .createUserWithEmailAndPassword(publisher.email, publisher.password)
            .then((newUser) => {
              firebase
                .firestore()
                .collection("users")
                .doc(newUser.user.uid)
                .set({
                  email: publisher.email,
                  mosqueId: $currentUser.user.mosqueId,
                  canEditNotes: true,
                  canEditPrayerTimes: false,
                  role: "publisher",
                  topics: [],
                  org: {
                    id: $currentUser.user.org.id,
                    type: $currentUser.user.org.type,
                  },
                })
                .then(() => {
                  loading = false;
                  message = {
                    variant: "success",
                    text: $_("publisherCreateSuccess"),
                  };
                  // auth.signOut();
                  // logout();
                  goto("/logout");
                });
            })
            .catch((err) => {
              loading = false;
              message = {
                variant: "danger",
                text: $_(`userCreateError.${err.code}`),
              };
            });
        } else {
          loading = false;
          message = {
            variant: "danger",
            text: $_("publisherLimitReached"),
          };
        }
      });
  }
</script>

<div class="main-content">
  <div class="admin">
    <Container fluid>
      <Row class="justify-content-center">
        <Col xxl="3" md="6" sm="8">
          <div class="edit-profile">
            <Card class="border-0">
              <CardHeader>
                <div class="edit-profile__title">
                  <h6>{$_("addNew")} {$_("publisher")}</h6>
                </div>
              </CardHeader>
              <CardBody>
                <form on:submit|preventDefault={handleSubmit}>
                  <div class="edit-profile__body">
                    <FormGroup class="form-group mb-25">
                      <Label for="username">{$_("email")}</Label>
                      <Input
                        bind:value={publisher.email}
                        invalid={message.variant && message.variant !== "success"}
                        type="email"
                        class="form-control"
                        id="email"
                        name="email"
                        placeholder={$_("email")}
                        autocomplete="off"
                      />
                    </FormGroup>
                    <FormGroup class="form-group mb-15">
                      <Label for="password">{$_("password")}</Label>
                      <div class="position-relative">
                        <Input
                          bind:value={publisher.password}
                          invalid={message.variant && message.variant !== "success"}
                          type="password"
                          class="form-control"
                          id="password"
                          name="password"
                          placeholder={$_("password")}
                          autocomplete="off"
                        />
                      </div>
                    </FormGroup>

                    {#if message.type === "danger"}
                      <div class="invalid-feedback">{message.text}</div>
                    {:else if message.type === "success"}
                      <div color="green">{message.text}</div>
                    {/if}

                    <div
                      class="admin__button-group button-group d-flex pt-1 justify-content-md-start justify-content-center"
                    >
                      <Button
                        type="submit"
                        color="primary"
                        class="btn btn-primary btn-default w-100 btn-squared text-capitalize lh-normal px-50 signIn-createBtn "
                      >
                        {loading ? $_("loading") : $_("createPublisher")}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        </Col>
      </Row>
    </Container>
  </div>
</div>

<style lang="scss">
  :global {
    @import "../../../../assets/sass/components/style.scss";
  }
</style>
