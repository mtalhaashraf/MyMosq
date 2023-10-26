import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";
import "firebase/compat/firestore";
import "firebase/compat/functions";
import "firebase/compat/storage";
import "firebase/compat/app-check";
import { equals, has, hasPath } from "ramda";
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// import {
//   MYMOSQ_APP_API_KEY,
//   MYMOSQ_APP_AUTH_DOMAIN,
//   MYMOSQ_APP_DATBASE_URL,
//   MYMOSQ_APP_PROJECT_ID,
//   MYMOSQ_APP_STORAGE_BUCKET,
//   MYMOSQ_APP_MESSAGING_SENDER_ID,
//   MYMOSQ_APP_ID,
//   MYMOSQ_APP_MEASUREMENT_ID,
// } from "$env/static/public";

import * as env from "$env/static/public";

let app;

if (!firebase.apps.length) {
  app = firebase.initializeApp({
    apiKey: env.MYMOSQ_APP_API_KEY,
    authDomain: env.MYMOSQ_APP_AUTH_DOMAIN,
    databaseURL: env.MYMOSQ_APP_DATBASE_URL,
    projectId: env.MYMOSQ_APP_PROJECT_ID,
    storageBucket: env.MYMOSQ_APP_STORAGE_BUCKET,
    messagingSenderId: env.MYMOSQ_APP_MESSAGING_SENDER_ID,
    appId: env.MYMOSQ_APP_ID,
    measurementId: env.MYMOSQ_APP_MEASUREMENT_ID,
  });
} else {
  app = firebase.app();
}

// const app = firebase.initializeApp({
//   apiKey: process.env.MYMOSQ_APP_API_KEY,
//   authDomain: process.env.MYMOSQ_APP_AUTH_DOMAIN,
//   databaseURL: process.env.MYMOSQ_APP_DATBASE_URL,
//   projectId: process.env.MYMOSQ_APP_PROJECT_ID,
//   storageBucket: process.env.MYMOSQ_APP_STORAGE_BUCKET,
//   messagingSenderId: process.env.MYMOSQ_APP_MESSAGING_SENDER_ID,
//   appId: process.env.MYMOSQ_APP_APP_ID,
//   measurementId: process.env.MYMOSQ_APP_MEASUREMENT_ID,
// });

// const appCheck = firebase.appCheck(app);
// // Pass your reCAPTCHA v3 site key (public key) to activate(). Make sure this
// // key is the counterpart to the secret key you set in the Firebase console.
// appCheck.activate(
//   "6LfoNYcgAAAAAGt9OcMmGUqDVP_EkK1i0v_LZMgJ",

//   // Optional argument. If true, the SDK automatically refreshes App Check
//   // tokens as needed.
//   true
// );

// const appCheck = initializeAppCheck(app, {
//   provider: new ReCaptchaV3Provider("6LfoNYcgAAAAAGt9OcMmGUqDVP_EkK1i0v_LZMgJ"),

//   // Optional argument. If true, the SDK automatically refreshes App Check
//   // tokens as needed.
//   // isTokenAutoRefreshEnabled: true,
// });

export const auth = app.auth();
export const db = app.database();
export const storage = app.storage();
export const firestore = firebase.firestore;
export const functions = firebase.app().functions("europe-west1");

// NOTE: uncomment the following lines to use the local emulator
// firebase.firestore().useEmulator("localhost", 8080);
// firebase.functions().useEmulator("localhost", 5001);
// firebase.database().useEmulator("localhost", 9000);

export const addPostsDataToStatsPosts = async () => {
  const postRef = await app.firestore().collection("posts").get();
  postRef.docs.forEach((doc) => {
    const data = doc.data();
    app
      .firestore()
      .collection("statsPosts")
      .doc(doc.id)
      .set({
        views: data?.views || null,
      });
  });
};

export const addMosqesDataToStatsMosque = async () => {
  const mosqueRef = await app.firestore().collection("topics").get();
  mosqueRef.docs.forEach((doc) => {
    const data = doc.data();
    app
      .firestore()
      .collection("statsTopics")
      .doc(doc.id)
      .set({
        subs: data?.subs || null,
      });
  });
};

export const updateTopicNumPosts = async () => {
  const topicsRef = await app.firestore().collection("topics").get();

  topicsRef.forEach(async (doc) => {
    const postsRef = await app.firestore().collection("posts").where("topicId", "==", doc.id).get();

    await app.firestore().collection("statsTopics").doc(doc.id).set(
      {
        numPosts: postsRef.size,
      },
      { merge: true }
    );
  });
};

export const updateMosqNumPosts = async () => {
  const topicsRef = await app.firestore().collection("topics").get();

  topicsRef.forEach(async (doc) => {
    const postsRef = await app.firestore().collection("posts").where("topicId", "==", doc.id).get();

    await app.firestore().collection("statsTopics").doc(doc.id).set(
      {
        numPosts: postsRef.size,
      },
      { merge: true }
    );
  });
};

export const restoreTopics = async () => {
  const topics = await app.firestore().collection("cache").doc("topics").get();

  Object.entries(topics.data()).forEach(async ([key, value]) => {
    await app
      .firestore()
      .collection("topics")
      .doc(key)
      .set({
        ...value,
      });
  });
};

export const updateStatsMosqNumPosts = async () => {
  const mosquesRef = await app.firestore().collection("mosques").get();

  mosquesRef.forEach(async (doc) => {
    const posts = await app.firestore().collection("posts").where("org.id", "==", doc.id).get();

    await app.firestore().collection("statsMosques").doc(doc.id).set(
      {
        numPosts: posts.size,
      },
      { merge: true }
    );
  });
};

export const updateStatsUnionNumPosts = async () => {
  const unionsRef = await app.firestore().collection("Unions").doc("unions").get();

  Object.entries(unionsRef.data()).forEach(async ([key, value]) => {
    const posts = await app.firestore().collection("posts").where("org.id", "==", key).get();

    await app.firestore().collection("statsUnions").doc(key).set(
      {
        numPosts: posts.size,
      },
      { merge: true }
    );
  });
};

export const foo = async () => {
  const topicsRef = await app.firestore().collection("topics").get();

  let mosqueTopics = [];

  let allTopics = [];

  topicsRef.forEach((doc) => {
    const data = doc.data();

    allTopics.push({ id: doc.id, ...data });
    if (!has("org")(data)) mosqueTopics.push({ id: doc.id, ...data });
  });

  mosqueTopics.forEach(async (e) => {
    const topics = allTopics.filter(
      (t) => hasPath(["org", "id"])(t) && equals(t.org.id, e.mosqueId)
    );

    if (topics.length) {
      // console.log(e.id);
      // await app.firestore().collection("topics").doc(e.id).delete();
    }
  });
};

export default app;
