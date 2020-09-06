import * as m from "../flex-match";
import * as atc from "./anchor-text-classifier";

// "side effect" rules find anchor texts that might cause damage like unsubscribing to a email periodical
export const commonSideEffectRules: atc.AnchorTextClassificationRule<any>[] = [
    atc.sideEffectRule(m.exactMatchOneOf(
        "unsubscribe",
        "update email preferences",
        "update your preferences",
        "update profile",
        "manage your subscriptions",
        "manage preferences",
        "personalize",
        "update subscription preferences")),
    atc.sideEffectRule(m.regExpMatch(/subscribe/)),
    atc.sideEffectRule(m.regExpMatch(/^i no longer wish to receive .*? emails$/)),
];

// General Email Regex (RFC 5322 Official Standard) - from https://emailregex.com/
const emailAddressRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const commonRules: atc.AnchorTextClassificationRule<any>[] = [
    atc.blankTextRule(),
    ...commonSideEffectRules,
    atc.nonContentRule(m.startsWith("mailto:"), { modifiers: ["mail-to"] }),
    atc.nonContentRule(m.exactMatchOneOf(
        "contact us",
        "email me",
        "why did i get this?",
        "add us to your address book",
        "media kit",
        "try email marketing for free today!",
        "advertise"), { modifiers: ["promotion"] }),
    atc.nonContentRule(m.exactMatchOneOf(
        "disclosures",
        "privacy policy"), { modifiers: ["legal"] }),
    atc.nonContentRule(m.exactMatchOneOf(
        "view this email in your browser",
        "view in browser",
        "view web version"), { modifiers: ["read-in-browser"] }),
    atc.nonContentRule(m.regExpMatch(/^@[a-z0-9_]+$/), { modifiers: ["twitter-handle"] }),
    atc.nonContentRule(m.regExpMatch(emailAddressRegExp), { modifiers: ["email-address"] }),
    atc.contentRule(m.startsWith("ebook: "), { modifiers: ["ebook"] }),
    atc.contentRule(m.startsWith("whitepaper: "), { modifiers: ["whitepaper"] }),
];
