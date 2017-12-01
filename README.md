# enzyme-styleguidist-sample-parser

Write generic React component samples - run jest/enzyme tests and generate
react-syleguidist examples

### Example Usage:

`/samples/MyComponent.js`

```js
const containerStyle = {
  component: MyComponent,
  props: { style: { backgroundColor: "#071" } },
  enzyme: {
    tests: {
      shallow: { snapshot: snapShot() }
    }
  }
};
```
