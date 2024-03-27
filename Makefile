TYPEDOC:= ./node_modules/.bin/typedoc
TSC:= ./node_modules/.bin/tsc

# Build the source.
build:
	$(TSC)

# Run the app locally.
run: build
	node lib/index.js

# Generate docs.
docs:
	$(TYPEDOC)
	cp CNAME docs/
	cp .nojekyll docs/

# Remove built source and dependencies.
clean:
	rm -rf ./lib
	rm -rf ./node_modules
	rm -f package-lock.json

# Update dependencies and set new version.
update:
	-ncu -u -x chai,chalk
	-ncu -u --target minor
	npm version $(shell date '+%y.%-V%u.1%H%M') --force --allow-same-version --no-git-tag-version
	npm install

# Publish to NPM.
publish:
	npm publish

.PHONY: docs test
