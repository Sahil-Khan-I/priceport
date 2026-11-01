import * as booking from "./booking/index";
import * as agoda from "./agoda/index";
import * as expedia from "./expedia/index";
import * as official from "./official/index";

const registry = {
  booking,
  agoda,
  expedia,
  official,
};

export function listProviders() {
  return Object.values(registry).map((provider) => ({
    id: provider.id,
    name: provider.name,
    domains: provider.domains || [],
  }));
}

export function getProviderAdapter(id) {
  return registry[id] || null;
}
