import { app } from 'electron';
import { withSecureWindow } from 'main/lib/create-secure-window';
import { DataRequestProvider, ProviderFile } from '../types';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

const windowParams = {
    key: 'facebook',
    origin: 'facebook.com',
};

const requestSavePath = path.join(app.getAppPath(), 'data');

class Facebook extends DataRequestProvider {
    public static key = 'facebook';
    public static dataRequestIntervalDays = 5;

    async initialise(): Promise<boolean> {
        await this.verifyLoggedInStatus();

        return true;
    }

    verifyLoggedInStatus = async (): Promise<Electron.Cookie[]> => {
        return withSecureWindow<Electron.Cookie[]>(windowParams, (window) => {
            const settingsUrl = 'https://www.facebook.com/settings';
            window.loadURL(settingsUrl);

            return new Promise((resolve) => {
                const eventHandler = async(): Promise<void> => {
                    // Check if we ended up at the page in an authenticated form
                    if (settingsUrl === window.webContents.getURL()) {
                        // If so, we retrieve the cookies
                        const cookies = await window.webContents.session.cookies.get({});
                        
                        resolve(cookies);
                    } else if (!window.isVisible()) {
                        // If not, we'll check if we need to open the window for the
                        // user to enter their credentials.
                        window.show();
                    }
                };

                window.webContents.on('did-navigate', eventHandler);
                window.webContents.once('did-finish-load', eventHandler);
            });
        });
    }

    update = async (): Promise<false> => {
        // NOTE: Updating is not supported by Facebook since it's internal API
        // is a enormous clusterfuck and cannot be trusted.
        return false;
    }

    dispatchDataRequest = async (): Promise<void> => {
        await this.verifyLoggedInStatus();

        return withSecureWindow<void>(windowParams, async (window) => {
            window.hide();

            await new Promise((resolve) => {
                window.webContents.on('did-finish-load', resolve)
                window.loadURL('https://www.facebook.com/dyi/?referrer=yfi_settings&tab=new_archive');
            });

            // Now we must defer the page to the user, so that they can enter their
            // password. We then listen for a succesfull AJAX call 
            return new Promise((resolve) => {
                window.webContents.session.webRequest.onCompleted({
                    urls: [ 'https://*.facebook.com/*' ]
                }, (details: Electron.OnCompletedListenerDetails) => {
                    console.log('NEW REQUEST', details);

                    if (details.url === 'https://www.facebook.com/api/graphql/'
                        && details.statusCode === 200) {
                        resolve();
                    }
                });

                // Ensure that the data request is in JSON format
                window.webContents.executeJavaScript(`
                    Array.from(document.querySelectorAll('label'))
                        .find(e => e.textContent.startsWith('Format'))
                        .querySelector('a')
                        .click();
                    Array.from(document.querySelectorAll('a[role="menuitemcheckbox"]'))
                        .find(e => e.textContent === 'JSON')
                        .click();
                `);

                window.webContents.executeJavaScript(`
                    Array.from(document.querySelectorAll('button'))
                        .find(el => el.textContent === 'Create File')
                        .click?.()
                `);
            });     
        });
    }

    async isDataRequestComplete(): Promise<boolean> {
        await this.verifyLoggedInStatus();

        return withSecureWindow<boolean>(windowParams, async (window) => {
            // Load page URL
            await new Promise((resolve) => {
                window.webContents.once('did-finish-load', resolve)
                window.loadURL('https://www.facebook.com/dyi/?referrer=yfi_settings&tab=all_archives');
            });

            // Find a div that reads 'A copy of your information is
            // being created'
            // 1. Retrieve all iframes in the website, as the right view is
            //    embedded in it
            // 2. Check if there is a span with "pending" in it
            return window.webContents.executeJavaScript(`
                !Array.from(document.querySelectorAll('iframe')).reduce((sum, iframe) => {
                    const spans = Array.from(iframe.contentWindow.document.body.querySelectorAll('span'));
                    const pending = spans.find(span => span.textContent === 'Pending');
                    return pending ? true : sum;
                }, false);
            `);
        });
    }

    async parseDataRequest(extractionPath: string): Promise<ProviderFile[]> {
        return withSecureWindow<ProviderFile[]>(windowParams, async (window) => {
            // Load page URL
            await new Promise((resolve) => {
                window.webContents.once('dom-ready', resolve)
                window.loadURL('https://www.facebook.com/dyi/?referrer=yfi_settings&tab=all_archives');
            });

            const filePath = path.join(requestSavePath, 'facebook.zip');
            await new Promise((resolve) => {
                // Create a handler for any file saving actions
                window.webContents.session.once('will-download', (event, item) => {
                    // Save the item to the data folder temporarily
                    item.setSavePath(filePath);
                    item.once('done', resolve);
                });

                // And then trigger the button click
                window.webContents.executeJavaScript(`
                    Array.from(document.querySelectorAll('iframe')).reduce((sum, iframe) => {
                        const buttons = Array.from(iframe.contentWindow.document.body.querySelectorAll('button'));
                        const button = buttons.find(button => button.textContent === 'Download' || button.textContent === 'Download Again');
                        return button || sum;
                    }, null)?.click();
                `);

                window.show();
            });

            // We have the ZIP, all that's left to do is unpack it and pipe it to
            // the repository
            const zip = new AdmZip(filePath);
            await new Promise((resolve) => 
                zip.extractAllToAsync(extractionPath, true, resolve)
            );

            // Translate this into a form that is readable for the ParserManager
            const files = zip.getEntries().map((entry): ProviderFile => {
                return {
                    filepath: entry.entryName,
                    data: null,
                    // data: entry.getData(),
                };
            });

            // And dont forget to remove the zip file after it's been processed
            await fs.promises.unlink(filePath);

            return files;
        });
    }
}

export default Facebook;