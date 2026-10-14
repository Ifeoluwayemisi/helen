import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FirstOwnerSetupForm, FirstOwnerSetupModal } from "./FirstOwnerSetup";

test("owner setup form renders name, email and credential fields", () => {
  const html = renderToStaticMarkup(
    <FirstOwnerSetupForm submitting={false} error={null} onSubmit={() => {}} />,
  );
  assert.match(html, /Full Name/);
  assert.match(html, /Email/);
  assert.match(html, /Password or PIN/);
  assert.match(html, /Create Owner Account/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
});

test("owner setup form shows a server error inside an alert region", () => {
  const html = renderToStaticMarkup(
    <FirstOwnerSetupForm
      submitting={false}
      error="Store owner has already been provisioned."
      onSubmit={() => {}}
    />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /already been provisioned/);
});

test("owner setup form disables submission while pending", () => {
  const html = renderToStaticMarkup(
    <FirstOwnerSetupForm submitting={true} error={null} onSubmit={() => {}} />,
  );
  assert.match(html, /disabled/);
  assert.match(html, /Creating owner account/);
});

test("owner setup modal renders the provisioning heading", () => {
  const html = renderToStaticMarkup(
    <FirstOwnerSetupModal submitting={false} error={null} onSubmit={() => {}} />,
  );
  assert.match(html, /Set Up Store Owner/);
});
