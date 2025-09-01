// import {writeFileSync } from "fs";
import { parse, stringify } from '@adobe/css-tools';

function processDeclarationUrls(css, baseUrl) {
    return (css || '').replaceAll(/url\((['"]?)(.*?)\1\)/ig, function perUrlMatch(_match, _quote, url) {
        return `url('${baseUrl}${url}')`;
    });
}

async function makeIsUsedSelector(cssOm, html) {
    const selectorList = Array.from(new Set(cssOm.stylesheet.rules.flatMap(function perRule(rule) {
        if (rule.type == "rule") {
            return rule.selectors;
        } else if (rule.type == "media") {
            return rule.rules.flatMap(rule => rule.selectors);
        } else {
            return [];
        }
    })))

    const result = await fetch(process.env.QUERY_SERVICE, {
        method: 'POST',
        body: JSON.stringify({ html, selectors: selectorList }),
        headers: {'content-type': 'application/json'}
    });
    const resSelectors = await result.json();
    const { res } = resSelectors;

    // writeFileSync('out.json', JSON.stringify(res), {encoding: 'utf8'});

    return function isUsedSelector(rule) {
        return rule.selectors.some(selector => {
            return res[selector] || false
        });
    }
}

export async function processCss(request, _reply) {
    const combinedCss = 
        request.body.css.reduce(function perCssFile(acc, [cssText, href]) {
            return `${acc}\n` + processDeclarationUrls(cssText, href);
        }, "");

    const parsedCss = parse(combinedCss, { silent: true });

    const isUsedSelector = await makeIsUsedSelector(parsedCss, request.body.html);

    const newRules = parsedCss.stylesheet.rules.filter(function perRule(rule) {
        if (rule.type == "rule") {
            return isUsedSelector(rule);
        } else if (rule.type == "media") {
            return rule.rules.some(isUsedSelector);
        } else {
            return true;
        }
    });

    const nonCriticalRules = parsedCss.stylesheet.rules.filter(function perRule(rule) {
        if (rule.type == "rule") {
            return !isUsedSelector(rule);
        } else if (rule.type == "media") {
            return !rule.rules.some(isUsedSelector);
        } else {
            return false;
        }
    });

    parsedCss.stylesheet.rules = newRules;
    const css = stringify(parsedCss, { compress: true });

    parsedCss.stylesheet.rules = nonCriticalRules;
    const nonCriticalCss = stringify(parsedCss, { compress: true });

    return { css, nonCriticalCss };
}