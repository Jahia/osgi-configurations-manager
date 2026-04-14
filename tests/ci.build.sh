#!/bin/bash
source ./set-env.sh

mkdir -p ./artifacts

if [[ -d ../target ]]; then
  artifact=$(find ../target -maxdepth 1 -type f -name '*.jar' ! -name '*sources.jar' ! -name '*javadoc.jar' | head -n 1)
  if [[ -n "${artifact}" ]]; then
    cp "${artifact}" ./artifacts/

    snapshot_artifact="../target/$(basename "${artifact%.jar}")-SNAPSHOT.jar"
    if [[ ! -f "${snapshot_artifact}" ]]; then
      cp "${artifact}" "${snapshot_artifact}"
    fi
  else
    echo "No built module JAR found in ../target"
  fi
fi

version=$(node -p "require('./package.json').devDependencies['@jahia/cypress']")
echo Using @jahia/cypress@$version...
npx --yes --package @jahia/cypress@$version ci.build
