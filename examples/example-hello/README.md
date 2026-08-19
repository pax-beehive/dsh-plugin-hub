# Hello DSH

`@dsh-plugin-hub/example-hello` is the smallest publishable DSH bundle used by
DSH Plugin Hub's npm-first end-to-end test.

It adds one harmless row to the Cordis configuration:

```yaml
- insert:
    - id: hello-dsh
      name: 'Hello from DSH Plugin Hub'
```

Install it with DeepSeek Harness:

```bash
dsh plugin --profile web add @dsh-plugin-hub/example-hello
```

The package contains no executable JavaScript and does not access user data.
