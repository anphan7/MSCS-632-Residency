# Requirements

Install these once before building the project.

## Tools

| Tool | Version | Used by | Check |
|------|---------|---------|-------|
| **Node.js** (with npm) | 18 or newer (tested on 24) | frontend + JavaScript backend | `node -v` |
| **JDK** (Java) | 17 or newer (tested on 26) | Java backend | `java -version` |

> **Gradle is NOT required** — the Java project ships a Gradle wrapper (`./gradlew`) that downloads the right Gradle version on first run. You only need a JDK 17+ on your `PATH` / `JAVA_HOME`.

## Project dependencies (installed per component)

You don't install these by hand — the commands below pull them automatically.

- **frontend/** → React 19, Vite (from `frontend/package.json`)
- **backend-node/** → Express, CORS (from `backend-node/package.json`)
- **backend-java/** → Javalin, Jackson (from `backend-java/build.gradle`)

## Easy install (all at once)

From the project root:

```bash
./setup.sh
```

This installs the frontend and Node-backend npm packages and builds the Java backend. (See the manual steps in the README if you prefer to do each one yourself.)

## macOS JDK note

If `./gradlew` complains it can't start (e.g. your default `JAVA_HOME` points at an old Java 8), point Gradle at a modern JDK:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

or copy `backend-java/gradle.properties.example` to `backend-java/gradle.properties` and set `org.gradle.java.home` to a JDK 17+ path.
