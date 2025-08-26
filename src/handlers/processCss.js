import { writeFileSync } from 'fs';
import { parse, stringify } from '@adobe/css-tools';

function makeProcessDeclarationUrls(baseUrl) {
    return function processDeclarationUrls(rule) {
        let { declarations } = rule;

        if (!declarations) {
            return rule;
        }

        declarations = declarations.map(function onDeclaration(declaration) {
            let { value } = declaration;
            value = value
            .replaceAll(/url\((['"]?)(.*?)\1\)/ig, function(_match, _quote, url) {
                return `url('${baseUrl}${url}')`;
            });

            return { ...declaration, value };
        });

        return {...rule, declarations};
    }
}

async function makeIsUsedSelector(cssOm, html) {
    const selectorList = Array.from(new Set(cssOm.stylesheet.rules.flatMap(function perRule(rule) {
        if (rule.type == "rule") {
            return rule.selectors;
        } else if (rule.type == "media") {
            return rule.rules.map(rule => rule.selector);
        } else {
            return [];
        }
    }))).map(function perSelector(selector) {
        return (selector || "")
            .replaceAll(/(:[^\s$]+)/gi, '');
    }).filter(selector => !!selector)

    // writeFileSync('outtt.json', JSON.stringify(selectorList));

    const result = await fetch(process.env.QUERY_SERVICE, {
        method: 'POST',
        body: JSON.stringify({ html, selectors: selectorList }),
        headers: {'content-type': 'application/json'}
    });
    const resSelectors = await result.json();
    const { res } = resSelectors;

    return function isUsedSelector(selector) {
        return res[selector] || false;
    }
}

export async function processCss(request, _reply) {
    const result = parse(request.body.css, { silent: true });

    const processDeclarationUrls = makeProcessDeclarationUrls('https://assets.boredpanda.com/blog/wp-content/themes/boredpanda/');

    const isUsedSelector = await makeIsUsedSelector(result, request.body.html);

    const newRules = result.stylesheet.rules.filter(function perRule(rule) {
        if (rule.type == "rule") {
            return isUsedSelector(rule);
        } else if (rule.type == "media") {
            return rule.rules.some(isUsedSelector);
        } else {
            return true;
        }
    }).map(function mapRules(rule) {
        if (rule.type == "rule") {
            return processDeclarationUrls(rule);
        } else if (rule.type == "media") {
            if (!rule.rules) {
                return rule;
            }

            return {
                ...rule,
                rules: rule.rules.map(processDeclarationUrls),
            }
        } else if (rule.type == "font-face") {
            return processDeclarationUrls(rule);
        } else {
            return rule;
        }
    });


    result.stylesheet.rules = newRules;

    const css = stringify(result, { compress: true });
    return { css };
}