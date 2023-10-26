import { writable } from "svelte/store";

export const currentUser = writable({
  user: null,
  hasNoOrg: null,
  settings: {},
  selectedCountry: "",
});

export function resetCurrentUser() {
  currentUser.set({
    user: null,
    hasNoOrg: null,
    settings: {},
    selectedCountry: "",
  });
}
