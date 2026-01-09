---
description: Deploy the module to the local Jahia instance
---

To deploy the module, use the `installBundle.sh` script logic. Since the agent might not have access to run the script directly if it depends on relative paths outside the workspace, use the direct API call which is robust.

1. Build the project (if not already done):
   ```bash
   mvn clean install
   ```

2. Deploy via API:
   // turbo
   ```bash
   curl -v -u root:welcome1 -X POST "http://localhost:8080/modules/api/bundles" -F bundle=@target/osgi-configurations-manager-1.0.0-SNAPSHOT.jar
   ```

   *Note: Credentials are usually `root` / `welcome1` for local dev environment.*
