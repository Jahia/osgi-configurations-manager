---
description: Build and deploy the module to the specific local filesystem modules folder
---

As per user request, systematically build and deploy to the specified modules directory when making corrections.

1. Build the project:
   // turbo
   ```bash
   mvn clean install
   ```

2. Deploy to the specific modules folder:
   // turbo
   ```bash
   cp target/osgi-configurations-manager-1.0.0-SNAPSHOT.jar /Users/dgigon/Tickets/LICENSE_SERVER/digital-factory-data/modules/
   ```
