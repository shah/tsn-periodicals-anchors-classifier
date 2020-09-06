import * as qc from "@shah/queryable-content";
import * as p from "@shah/ts-pipe";
import { Expect, SetupFixture, Test, TestCase, TestFixture } from "alsatian";
import * as fs from "fs";
import * as path from "path";
import mime from "whatwg-mimetype";
import * as pac from "./periodicals-anchors-classifier";

export interface EmailSupplierContent {
    messageId: string;
    fromAddress: string;
    fromName: string;
    date: string;
    subject: string;
    htmlContent: string
}

export interface EmailPeriodicalEdition extends pac.PeriodicalEdition {
    readonly subject: string;
}

export class EmailPeriodicalEditionPropsSupplier implements pac.PersistPropsTransformer {
    static readonly singleton = new EmailPeriodicalEditionPropsSupplier();

    flow(ctx: pac.PersistPropsTransformContext<EmailPeriodicalEdition>, suggested: pac.PersistProperties): pac.PersistProperties {
        return { ...suggested, subject: ctx.source.subject };
    }
}

@TestFixture("Periodicals Anchors Classifier")
export class EmailTestSuite {
    readonly destPath = "email-supplier-test-results";
    readonly contentTr: qc.ContentTransformer = p.pipe(qc.EnrichQueryableHtmlContent.singleton);
    readonly testEmails: EmailSupplierContent[] = require("./email-supplier-test-content.json");
    readonly supplier = new pac.TypicalPeriodicalSupplier("email://test");
    readonly stats = {
        editionsEncountered: 0,
        periodicalsEncountered: 0,
        editionAnchorsEncountered: 0,
    }

    constructor() {
    }

    @SetupFixture
    public async classifyEmailNewsletters(): Promise<void> {
        const periodicalsEncountered: { [name: string]: pac.Periodical } = {};
        for (const email of this.testEmails) {
            let periodical = this.supplier.registerPeriodical(`${email.fromName} <${email.fromAddress}>`);
            if (!periodicalsEncountered[periodical.name]) {
                periodicalsEncountered[periodical.name] = periodical;
                this.stats.periodicalsEncountered++;
            }
            const date = new Date(email.date);
            const content = await this.contentTr.flow({
                htmlSource: email.htmlContent,
                uri: `email://${email.messageId}/${email.fromAddress}/${email.fromName}/${date.toISOString()}/${email.subject}`
            }, {
                contentType: "text/html",
                mimeType: new mime("text/html"),
            }) as qc.QueryableHtmlContent;
            const anchors: pac.ClassifiedAnchor[] = [];
            content.anchors().map((anchor) => {
                anchors.push(periodical.registerAnchor(anchor))
            });
            this.stats.editionAnchorsEncountered += anchors.length;
            const pe: EmailPeriodicalEdition = {
                supplierContentId: email.messageId,
                fromAddress: email.fromAddress,
                fromName: email.fromName,
                date: date,
                anchors: anchors,
                subject: email.subject,
            }
            periodical.registerEdition(pe);
            this.stats.editionsEncountered++;
        }
        await this.supplier.classifyAnchors();
        this.stats.periodicalsEncountered = Object.keys(periodicalsEncountered).length;
    }

    @SetupFixture
    public persistPeriodicals(): void {
        pac.DefaultRelationalCsvTableWriters.recreateDir(this.destPath);
        const writerNames = pac.DefaultRelationalCsvTableWriters.NAMES;
        const writers = new pac.DefaultRelationalCsvTableWriters(this.destPath, pac.DefaultRelationalCsvTableWriters.UUID_NAMESPACE, {
            names: writerNames,
            periodicalEditions: new pac.TabularWriter({
                destPath: this.destPath, fileName: writerNames.periodicalEditions,
                parentUuidNamespace: pac.DefaultRelationalCsvTableWriters.UUID_NAMESPACE,
                ppTransform: EmailPeriodicalEditionPropsSupplier.singleton
            })
        });
        const db = new pac.PersistRelationalCSV(writers);
        db.persistSupplier(this.supplier);
        writers.close();
    }

    @Test("Ensure test content is available")
    public testEmailNewslettersSupplierCount(): void {
        Expect(this.testEmails.length).toBe(1191);
    }

    @Test("Ensure periodicals count is valid")
    public testPeriodicalsCount(): void {
        Expect(Object.keys(this.supplier.periodicals).length).toBe(this.stats.periodicalsEncountered);
    }

    @Test("Ensure periodicals count is valid")
    public testPeriodicalEditionsCount(): void {
        let count = 0;
        Object.values(this.supplier.periodicals).forEach(p => count += p.editions.length);
        Expect(count).toBe(this.stats.editionsEncountered);
    }

    @Test("Ensure periodicals editions anchors count is valid")
    public testPeriodicalEditionsAnchorsCount(): void {
        let count = 0;
        Object.values(this.supplier.periodicals).forEach(p => p.editions.forEach(pe => count += pe.anchors.length));
        Expect(count).toBe(this.stats.editionAnchorsEncountered);
    }

    @TestCase("suppliers.csv")
    @TestCase("periodicals.csv")
    @TestCase("periodical-anchors.csv")
    @TestCase("periodical-anchors-common.csv")
    @TestCase("periodical-editions.csv")
    @TestCase("periodical-edition-anchors.csv")
    @Test("Ensure files created")
    public testOutputFileCreated(fileName: string): void {
        Expect(fs.existsSync(path.join(this.destPath, fileName))).toBe(true);
    }
}
