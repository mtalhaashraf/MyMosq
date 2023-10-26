<script>
  import {
    Alert,
    Button,
    Card,
    CardBody,
    CardHeader,
    Col,
    Container,
    FormGroup,
    Input,
    Label,
    Row,
  } from "sveltestrap";
  import * as yup from "yup";
  import { auth } from "$lib/firebase.js";
  import { createForm } from "svelte-forms-lib";

  import { _ } from "svelte-i18n";

  let loading = false;
  let showSuccessMessage = false;

  const forgotPasswordSchema = yup.object().shape({
    email: yup.string().email().required(),
  });

  const { form, errors, handleChange, handleSubmit } = createForm({
    initialValues: {
      email: "",
    },
    validationSchema: forgotPasswordSchema,
    onSubmit: async (values) => {
      loading = true;

      auth
        .sendPasswordResetEmail(values.email)
        .then(() => {
          showSuccessMessage = true;
          loading = false;

          setTimeout(() => {
            showSuccessMessage = false;
          }, 5000);
        })
        .catch(console.error);
    },
  });
</script>

<div class="main-content">
  <div class="admin">
    <Container fluid>
      <Row class="justify-content-center">
        <Col xxl="3" md="6" sm="8">
          <div class="edit-profile">
            <div class="edit-profile__logos">
              <img class="png img" alt="" src={"favicon.png"} />
            </div>
            <Card class="border-0">
              <CardHeader>
                <div class="edit-profile__title">
                  <h6>{$_("forgottenPassword")}</h6>
                </div>
              </CardHeader>
              <CardBody>
                <form class="edit-profile__body" on:submit|preventDefault={handleSubmit}>
                  <FormGroup class="form-group mb-20">
                    <Label for="email">{$_("email")}</Label>
                    <Input
                      on:change={handleChange}
                      bind:value={$form.email}
                      invalid={$errors.email.length > 0}
                      type="text"
                      class="form-control"
                      id="email"
                      placeholder={$_("email")}
                    />
                    {#if $errors.email}
                      <div class="invalid-feedback">{$errors.email}</div>
                    {/if}
                  </FormGroup>

                  <div class="admin-condition">
                    <a href="/logout">{$_("backTo")} {$_("login")}</a>
                  </div>

                  <div class="d-flex">
                    <Button
                      color="primary"
                      size="default"
                      class="btn-squared text-capitalize lh-normal px-md-50 signIn-createBtn"
                    >
                      {loading ? $_("processingRequest") : $_("resetPassword")}
                    </Button>
                  </div>
                </form>

                {#if showSuccessMessage}
                  <Alert color="success">
                    An email has been sent to your account with necessary instructions.
                  </Alert>
                {/if}

                <div style="height: 1rem;" />
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
    @import "../../../../src/assets/sass/components/style.scss";
  }
</style>
