<script>
  import { _ } from "svelte-i18n";
  import { Card, CardBody, Alert, Container } from "sveltestrap";
</script>

<section>
  <Container class="d-flex align-items-center justify-content-center">
    <div class="w-100" style={{ maxWidth: "450px", marginBottom: "5rem" }}>
      <Card>
        <CardBody>
          <Alert color="danger">{$_("insufficientPrivileges")}</Alert>
          {$_("backTo")}&nbsp;
          <a href="/logout">{$_("login")}</a>
        </CardBody>
      </Card>
    </div>
  </Container>
</section>
