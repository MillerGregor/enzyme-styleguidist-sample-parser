// @flow
import React from "react";
import PropTypes from "prop-types";
import { mount, render, shallow } from "enzyme";
import capitalize from "lodash.capitalize";
import cloneDeep from "lodash.clonedeep";
import each from "lodash.foreach";
import loGet from "lodash.get";
import merge from "lodash.merge";
import jsxToString from "react-element-to-jsx-string";
import StringBuilder from "string-builder";
import path from "path";
import fs from "fs";
import fse from "fs-extra";
import log from "loglevel";

const HEADER = `\n[//]: # (** auto-generated ${new Date().toISOString()} **)\n`;
const METHODS = "methods";
const PROPS = "props";

function smallUUID(a) {
    return a
        ? (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, smallUUID);
}

export function genRefId() {
    const id = smallUUID().replace(/-/g, "");
    return `ref${id}`;
}

export function assignRef(refId) {
    return Function("ref", `return ${refId} = ref`);
}

const buildCtxOptions = ctxArr => {
    let options = { context: {}, childContextTypes: {} };
    ctxArr.forEach(ctx => {
        if (ctx.type && ctx.type === "func") {
            const mockFunc = jest.fn();
            mockFunc.mockReturnValue(ctx.value);
            options = merge(options, {
                context: { [ctx.name]: mockFunc },
                childContextTypes: { [ctx.name]: toPropType(ctx.type) }
            });
        }
    });
    return options;
};

const toPropType = typeId => {
    switch (typeId) {
        case "func":
            return PropTypes.func;
        default:
            return null;
    }
};

const _defaultCreateWrapper = (depth, jsx, ctx) => {
    let wrapper;
    let ctxOpts = {};
    if (ctx) ctxOpts = buildCtxOptions(ctx);
    switch (depth) {
        case "mount":
            wrapper = mount(jsx, ctxOpts);
            break;
        case "shallow":
            delete ctxOpts.childContextTypes;
            wrapper = shallow(jsx, ctxOpts);
            break;
        case "render":
            wrapper = render(jsx);
            break;
        default:
    }
    if (wrapper) log.debug(wrapper.html());
    if (wrapper) log.debug(wrapper.debug());
    return wrapper;
};

const _defaultBuildJsx = attr => {
    try {
        const jsx = React.createElement(
            attr.component,
            attr.props,
            attr.children
        );
        return jsx;
    } catch (err) {
        log.error(err);
    }
};

const _defaultJsxToString = jsx => {
    // $FlowExpectedError
    return jsxToString(jsx, {
        showFunctions: true,
        showDefaultProps: false
    });
};

const _processAttribute = (attr, opts) => {
    if (loGet(opts, "enzyme.run")) {
        let buildJsx = loGet(attr, "enzyme.buildJsx", _defaultBuildJsx);
        const jsx = buildJsx(attr);
        log.debug({ attr });
        each(loGet(attr, "enzyme.tests", {}), (depth, depthName) => {
            log.debug({ depthName, depth });
            each(depth, (jestTest, testName) => {
                log.debug({ attr });
                const title = attr.title.concat(
                    " enzyme-",
                    depthName,
                    ": ",
                    testName
                );
                const wrapper = loGet(
                    opts,
                    "enzyme.createWrapper",
                    _defaultCreateWrapper
                )(depthName, jsx, attr.enzyme.context);
                jestTest(wrapper, title, attr.name);
            });
        });
    }
    if (loGet(opts, "styleguidist.build")) {
        attr.stringBuilder.appendLine("\n#### " + attr.displayName);
        attr.stringBuilder.append("\n```js\n");
        if (loGet(opts, "styleguidist.script"))
            attr.stringBuilder.appendLine(opts.styleguidist.script);
        let jsx;
        let jsxString;
        if (loGet(attr, "styleguidist.script"))
            attr.stringBuilder.appendLine(attr.styleguidist.script);
        if (loGet(attr, "styleguidist.getJsxString")) {
            jsxString = loGet(attr, "styleguidist.getJsxString")(attr); // this get attr
        } else {
            jsx = loGet(attr, "styleguidist.buildJsx", _defaultBuildJsx)(attr);
            jsxString = _defaultJsxToString(jsx); // this gets jsx
        }
        attr.stringBuilder.appendLine(jsxString);
        attr.stringBuilder.appendLine("\n```\n");
    }
};

const _processComponent = (compSect, opts) => {
    log.info({ compSect });
    each(compSect.samples, (attrDefs, attrTypeName) => {
        log.info({ attrTypeName });
        let descTitle = compSect.title.concat(" ", capitalize(attrTypeName));
        if (loGet(opts, "styleguidist.build")) {
            descTitle = descTitle.concat(" Styleguide Examples");
            compSect.stringBuilder.appendLine("\n### " + attrTypeName + "\n");
        }
        describe(descTitle, () => {
            each(attrDefs, (attr, name) => {
                attr.attrType = attrTypeName;
                attr.name = name;
                attr.displayName = name.concat(
                    attrTypeName === METHODS ? "()" : ""
                );
                attr.title = compSect.title.concat(
                    ` [ ${attrTypeName.slice(0, -1)}:`,
                    ` ${attr.displayName}`,
                    " ]"
                );

                if (loGet(opts, "styleguidist.build")) {
                    attr.stringBuilder = compSect.stringBuilder;
                }

                _processAttribute(attr, opts);
            });
        });
    });
};

const _processSection = (section, opts) => {
    let exampleWritten = false;
    log.info({ section });
    each(section.sectionComponents, (compSect, name) => {
        compSect.title = section.title.concat(": ", name, ":");
        if (loGet(opts, "styleguidist.build")) {
            compSect.exampleFileName = path
                .join(opts.styleguidist.examplesDir, name)
                .concat(".md");
            compSect.stringBuilder = new StringBuilder();
            compSect.stringBuilder.appendLine(HEADER);
        }
        _processComponent(compSect, opts);
        if (loGet(opts, "styleguidist.build")) {
            fse.outputFileSync(
                compSect.exampleFileName,
                compSect.stringBuilder
            );
            exampleWritten = true;
            test(compSect.title + " example file written", () => {
                expect(exampleWritten).toBeTruthy();
            });
        }
    });
};

export default function parseSamples(sections: Object, options: Object) {
    if (options.log) log.setLevel(options.log);
    else log.setLevel(`WARN`);

    log.debug({ options });
    log.info({ sections });
    each(sections, (section, sectionKey) => {
        section.title = sectionKey;

        // guide first to avoid the mocks
        if (loGet(options, "styleguidist.build")) {
            const guideOpts = cloneDeep(options);
            delete guideOpts.enzyme;
            log.info(`Styleguide: processing Section: ${sectionKey}`);
            _processSection(section, guideOpts);
        }

        if (loGet(options, "enzyme.run")) {
            const testOpts = cloneDeep(options);
            delete testOpts.styleguidist;
            if (options.mocks) options.mocks();
            _processSection(section, testOpts);
        }
    });
}
