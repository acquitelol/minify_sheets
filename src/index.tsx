// main imports of elements and dependencies
import { Plugin, registerPlugin } from 'enmity/managers/plugins';
import { getIDByName } from 'enmity/api/assets';
import { bulk, filters, getByProps } from 'enmity/metro'
import { React, Toasts } from 'enmity/metro/common';
import { create } from 'enmity/patcher';
import manifest from '../manifest.json';
import Settings from './components/Settings';
import {getBoolean } from 'enmity/api/settings';

// main declaration of modules being altered by the plugin
const [
   LazyActionSheet, // main patch component
   ChannelStore // to get the channel id of a message
] = bulk(
   filters.byProps("openLazy", "hideActionSheet"),
   filters.byProps("getChannel", "getDMFromUserId"),
);

// initialization of patcher
const Patcher = create('minify-sheets');


const MinifySheets: Plugin = {
   ...manifest,
   commands: [], // start off with no commands
   patches: [], // start off with no patches

   onStart() {
      let attempt = 0; // starts at attempt 0
      let attempts = 3; // max 3 attempts
      const unpatchActionSheet = () => {
            try {
               attempt++; // increases attempt
               let enableToasts = getBoolean("Dislate", "toastEnable", false)

               console.log(`[MinifySheets] delayed start attempt ${attempt}/${attempts}.`);

               enableToasts?Toasts.open({
                    content: `[MinifySheets] start attempt ${attempt}/${attempts}.`,
                    source: getIDByName('debug'),
               }):console.log("[MinifySheets] Init Toasts are disabled.")
               // ^^^ only opens a toast showing attempts if its enabled in settings
            
               // main patch of the action sheet
               Patcher.before(LazyActionSheet, "openLazy", (_, [component, sheet], _res) => {
                  if (sheet === "MessageLongPressActionSheet") { // only works for the long press on message context menu
                     component.then((instance) => { // patches the component which was fetched when the openLazy event was fired
                        Patcher.after(instance, "default", (_, message, res) => {
                           // returns if theres no props on res
                           if (!res.props) {
                              console.log(`[MinifySheets Local Error: Property "Props" Does not Exist on "res"]`)
                              return res; // (dont do anything more)
                           }

                           // array of all buttonRow items in the lazyActionSheet
                           let finalLocation = res?.props?.children?.props?.children?.props?.children[1]
                           // if any of these dont exist, it will return undefined instead of throwing an error

                           finalLocation = finalLocation.filter(item => {
                              return item?.props?.message!='Mark Unread'&&item?.props?.message!='Mention'&&item?.props?.message!='Create Thread'&&item?.props?.message!='Feature Message'
                           })
                        })
                     });
                  }
               })
            } catch(err) {
               // log any errors that would happen
               console.log(`[MinifySheets Local Error ${err}]`);
               let enableToasts = getBoolean("Dislate", "toastEnable", false) // checks if you have the init toasts setting enabled to alert you in app

                if (attempt < attempts) { // only tries again if it attempted less than 3 times
                    console.warn(
                        `[MinifySheets] failed to start. Trying again in ${attempt}0s.`
                    );
                    enableToasts?
                    Toasts.open({
                        content: `[MinifySheets] failed to start trying again in ${attempt}0s.`,
                        source: getIDByName('ic_message_retry'),
                    }):console.log("[MinifySheets] Init toasts are disabled.")

                    // waits the amount of time extra each attempt to allow for init of any services
                    setTimeout(unpatchActionSheet, attempt * 10000); 
                } else {
                     // gives up on attempting to init dislate
                    console.error(`[MinifySheets] failed to start. Giving up.`);
                    enableToasts? // only sends if toast options are enabled
                    Toasts.open({
                        content: `[MinifySheets] failed to start. Giving up.`,
                        source: getIDByName('Small'),
                    }):console.log("[MinifySheets] Init toasts are disabled.")
                }
            }
      }

      setTimeout(() => {
         unpatchActionSheet(); // calls the function (code is synchronous so this will work)
         this.patches.push(Patcher)
      }, 300); // gives flux time to init
   },

   onStop() {
      // unpatches everything, and clears commands
      this.commands = [];
      this.patches = [];
      Patcher.unpatchAll();
   },

   getSettingsPanel({ settings }) {
      return <Settings settings={settings} />;
   },
};

registerPlugin(MinifySheets);