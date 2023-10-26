<script>
  import { goto } from "$app/navigation";
  import { createForm } from "svelte-forms-lib";
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
  import * as yup from "yup";
  import { DataService } from "../../../config/dataService";
  import Checkbox from "@components/checkbox/Checkbox.svelte";
  import { setItem } from "../../utility/localStorageController";
  const googleIcon = "/img/svg/google-Icon.svg";

  import { auth } from "$lib/firebase.js";
  import { onMount } from "svelte";
  import { currentUser } from "@store/currentUser.js";
  import { _ } from "svelte-i18n";
  import { hasPath } from "ramda";
  import { redirectUserToAvailableRoute, isValidUser } from "@utility/helpers.js";

  // onMount(() => {
  //   return auth.onAuthStateChanged((user) => {
  //     if (user) {
  //       console.log("logged in successfully");
  //
  //       $currentUser.user = user;
  //
  //       goto("/");
  //     } else {
  //       console.log("logged out successfully");
  //     }
  //   });
  // });

  $: if ($currentUser.user) reactToLogin();

  let errorMessage = "";

  function reactToLogin() {
    if ($currentUser.hasNoOrg) {
      errorMessage = "noMosqueError";
      return;
    }

    if (
      hasPath(["org", "permissions", "adminPanel"])($currentUser.user) &&
      !$currentUser.user?.org.permissions.adminPanel
    ) {
      errorMessage = "Cannot Access Admin Panel";
      return;
    }

    if (!$currentUser.user) return;

    errorMessage = "";

    if (!$currentUser.user?.role) return;

    // redirectUserToAvailableRoute($currentUser.user, goto);
    goto("/");
  }

  let visible = true;
  let loader = false;
  let notification = {};

  const loginSchema = yup.object().shape({
    email: yup.string().email().required(),
    password: yup.string().required(),
  });

  const { form, errors, handleChange, handleSubmit } = createForm({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema: loginSchema,
    onSubmit: async (values) => {
      loader = true;
      errorMessage = "";

      auth
        .signInWithEmailAndPassword(values.email, values.password)
        .then(() => {
          console.log("logged in successfully");
        })
        .catch((error) => {
          console.error(error);
          errorMessage = "loginFailed";
        })
        .finally(() => {
          loader = false;
        });

      visible = true;
    },
  });
  const handleCheckBox = () => {};
</script>

<div class="main-content">
  <div class="admin">
    <Container fluid>
      <Row class="justify-content-center">
        <Col xxl="3" md="6" sm="8">
          <div class="edit-profile">
            <!-- <img src="/img/logo-dark.svg" class="svg" alt="" /> -->
            <!-- <div class="edit-profile__logos">
              <img
                src="/favicon.png"
                class="png"
                style="width: 200px; display: block; margin: auto; padding: 20px;"
                alt=""
              />
            </div> -->
            <Card class="border-0">
              <!-- {#if loader}
								<Spinner type="primary" size="md" />
							{/if} -->
              <CardHeader>
                <div class="edit-profile__title">
                  <h6>Login MyMosq Admin</h6>
                </div>
              </CardHeader>
              <CardBody>
                {#if notification.errors}
                  <Alert
                    color="danger"
                    isOpen={visible}
                    toggle={() => (visible = false)}
                    fade={false}
                  >
                    {notification.errors}
                  </Alert>
                {/if}
                <form on:submit|preventDefault={handleSubmit}>
                  <div class="edit-profile__body">
                    <FormGroup class="form-group mb-25">
                      <Label for="username">{$_("email")}</Label>
                      <Input
                        on:change={handleChange}
                        bind:value={$form.email}
                        invalid={$errors.email.length > 0}
                        type="email"
                        class="form-control"
                        id="email"
                        name="email"
                        placeholder={$_("email")}
                      />
                      {#if $errors.email}
                        <div class="invalid-feedback">{$errors.email}</div>
                      {/if}
                    </FormGroup>
                    <FormGroup class="form-group mb-15">
                      <Label for="password">{$_("password")}</Label>
                      <div class="position-relative">
                        <Input
                          on:change={handleChange}
                          bind:value={$form.password}
                          invalid={$errors.password.length > 0}
                          type="password"
                          class="form-control"
                          id="password"
                          name="password"
                          placeholder={$_("password")}
                        />
                        {#if $errors.password}
                          <div class="invalid-feedback">{$errors.password}</div>
                        {/if}
                      </div>
                    </FormGroup>
                    <div class="admin-condition">
                      <!-- <Checkbox type="default" id="check-1" onChange={handleCheckBox}>
                        Keep Me Logged In
                      </Checkbox> -->
                      <a href="/forgot-password">{$_("forgottenPassword")}</a>
                    </div>
                    <div
                      class="admin__button-group button-group d-flex pt-1 justify-content-md-start justify-content-center"
                    >
                      <Button
                        type="submit"
                        color="primary"
                        class="btn btn-primary btn-default w-100 btn-squared text-capitalize lh-normal px-50 signIn-createBtn "
                      >
                        {loader ? $_("loading") : $_("login")}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardBody>
              <!-- <div class="px-20">
                <p class="social-connector social-connector__admin text-center">
                  <span>Or</span>
                </p>
                <div class="button-group d-flex align-items-center justify-content-center">
                  <ul class="admin-socialBtn">
                    <li>
                      <Button class="btn text-dark google">
                        <img src={googleIcon} class="svg" alt="" />
                      </Button>
                    </li>
                    <li>
                      <Button class=" radius-md wh-48 content-center facebook">
                        <i class="uil uil-facebook-f" />
                      </Button>
                    </li>
                    <li>
                      <Button class="radius-md wh-48 content-center twitter">
                        <i class="uil uil-twitter" />
                      </Button>
                    </li>
                    <li>
                      <Button class="radius-md wh-48 content-center github">
                        <i class="uil uil-github" />
                      </Button>
                    </li>
                  </ul>
                </div>
              </div>
              <div class="admin-bottom">
                <p class="mb-0">
                  Don't have an account?
                  <a href="/signup" class="color-primary"> Sign up </a>
                </p>
              </div> -->
            </Card>

            <div style="height: 2rem;" />

            <Alert
              color="danger"
              class="alert-big"
              isOpen={!!errorMessage}
              toggle={() => (errorMessage = "")}
            >
              <div class="alert-content">
                <h6 class="alert-heading">{$_(errorMessage)}</h6>

                <button
                  type="button"
                  class="btn-close text-capitalize"
                  on:click={() => (errorMessage = "")}
                >
                  <img class="svg" alt="" src={"/img/svg/x.svg"} />
                </button>
              </div>
            </Alert>
          </div>
        </Col>
      </Row>
    </Container>
  </div>
</div>

<style lang="scss">
  :global {
    @import "../../../../src/assets/sass/components/style.scss";
  }
</style>
