import React from "react";
import Explorer from "./Explorer";
import { ClientDatabase } from "../../src/ClientDatabase";

// Create ClientDatabase instance
const database = new ClientDatabase();

function AppClient() {
  return <Explorer database={database} />;
}

export default AppClient;