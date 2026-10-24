# Contributing

**English** · [简体中文](CONTRIBUTING.zh-CN.md)

Build and test commands are in the [repository README](README.md#development).

## Plugin README structure

Each plugin maintains `README.md` in English and `README.zh-CN.md` in Chinese. Keep their structure, configuration and behavior descriptions aligned with the code.

Start with the plugin name, language links, a short description, and its ID, type and supported stages. Use these sections in order:

| Section | Content |
| --- | --- |
| Get started | Link to the main site's installation guide; describe the configuration entry, how to connect it to an upload profile, and how to verify the result. |
| Configuration | Use the columns **Field, Meaning, Required, Default, Constraints**. Include units and applicable ranges, secret, immutable or advanced settings. |
| Behavior and limitations | Explain supported operations, results, failures and retry behavior, and limits that affect user choices. |
| Development (optional) | Include only plugin-specific build or verification steps; link to the root README for shared commands. |

Examples are optional: include them when they clarify configuration. Keep prose concise; omit SDK internals, release procedures and temporary release status. Theme documentation need not follow this structure.

## Documentation ownership

Plugin READMEs are the source for plugin-specific details. The main site maintains the plugin directory, installation workflow and pipeline recipes, linking directly to the Chinese README. Built-in plugin documentation stays in the main repository.

Link to the main site's [pipeline guide (中文)](https://llleixx.github.io/picloom/guide/pipelines.html) for shared timing and disposition rules instead of duplicating them. Keep plugin-specific exceptions in its README.

When adding a plugin, update the extension lists in both root READMEs and the main site's plugin list and sidebar. When changing behavior or configuration, update both plugin languages. Before committing, check links and compare documented fields and defaults with the schema; build the documentation site when changing its pages or navigation.
