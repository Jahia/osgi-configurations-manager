# Tests
Two options are available to run the tests, you can either run everything in Docker or only run Jahia in Docker and run the tests using your local node.

The Cypress suite is now split by functional area under `tests/cypress/e2e` rather than kept in a single monolithic spec. Common helpers live in `tests/cypress/support/commands.js`.

### Run all in Docker

Once you have a built test container, the entirety of the tests, from environment provisioning to report generation, can be executed using a single command.

```bash
# Build the test container
> bash ci.build.sh
# Execute the tests
> bash ci.startup.sh
```

This is this exact process that will be used by the CI platform to execute the tests. And although it's definitely the easiest way of going through one run, it's also the method you're the less likely to use on a day-to-day (that would have been too easy, isn't it ?). 

The primary reason for this method to be "somewhat" reserved to the CI platform, is that it doesn't make it easy to develop new tests or debug one single test.

IMPORTANT: If you are using this method locally, do not forget that you will need to **rebuilt the test container** (`bash ci.build.sh`) for everytime a change is done in the `tests/` folder, otherwise your change will not make their way to the container.

### Run the tests on a local node

This is the method you will be using the most when developing or debug tests, and the major point of attention here concerns the use of the `env.run.sh` script.

As a reminder, the purpose of the `env.run.sh` script is to provision the environment **AND** execute the tests, in most cases you'd want to provision the environment only once, but run the tests multiple times.

```bash
# Fetch the necessary javascript dependencies
> yarn
# Run the docker environment, but without the tests
> ./ci.startup.sh notests
# Provision the environment and run the tests in headless once
> ./env.run.sh
# For bash
> ./set-env.sh
> yarn run e2e:debug
```

The advantage of this approach is that you'll get to run the tests in headless once, and although it delays a bit the time by which you can start developing, it also give you a good sense of whether your environment is setup properly.

Do *NOT* forget to load your environment variables using `source set-env.sh` prior to running Cypress, as well as **everytime you open a new terminal**.

In most situations you will end-up with a lot of unit tests, slightly less API e2e, and fewer UI e2e. Note that the purpose of these tests is to validate the proper behavior/operation of the module being developed. It would likely still be necessary to implement various high level integration tests to ensure your module operate well with other in different "real-life" deployment scenarios (but those tests are typically executed after merging of the code).

## Practical shortcuts

For day-to-day work on this module, the following wrappers are usually the most convenient:

```bash
# Run the E2E suite against the dockerized Jahia test stack
./run-e2e-docker.sh

# Run the E2E suite against a locally exposed Jahia on localhost:8080
./run-e2e-local.sh
```

If you run Cypress against a locally started Jahia, make sure the expected environment variables are loaded first:

```bash
source set-env.sh
```

## Environment variables worth knowing

| Variable | Why you need it |
|---|---|
| `JAHIA_LICENSE_FILE` | Path to a Jahia EE licence XML. Both `run-e2e-*.sh` wrappers fall back to a hardcoded path that only exists on the original author's machine, so set this. A 30-day demo licence is enough. |
| `JAHIA_IMAGE` | Jahia image to run. The CI workflow uses the public `jahia/jahia-ee:8.2.3.2`; override it to test against another version. |

The suite needs a licence allowing **4 concurrent users** — `root` plus the three scoped users the
authorization specs provision. A licence capped below that fails specs 08 and 09 with what looks like
an unrelated UI error, so check this first if those two are the only ones failing.
