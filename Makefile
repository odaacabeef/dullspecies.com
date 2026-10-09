.PHONY: dev build

# Local server at http://localhost:3000 that re-renders on every request.
dev:
	go run .

# Render the static site into dist/, same as the deploy workflow.
build:
	go run . -build
