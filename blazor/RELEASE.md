# RibbonWeb.Blazor 0.2.0

- Extend the canonical package to .NET 8/.NET 10 while preserving the existing RibbonWeb component, ICommand and original asset paths.
- Add typed definitions, native RibbonControl, Razor custom render factories and native function handles.
- Correct Server sample namespace resolution; qualify native Razor callbacks and compatible .NET event forwarding.
- Add streamed data/binary interop, explicit literal payloads, async lifecycle cleanup and scoped template roots.
- Package-restored WebAssembly/Server samples, root documentation, independent NuGet publication and public-payload verification.
- Update the Node browser-test runner from vulnerable Playwright 1.55.0 to the locked 1.63.0 version used by sibling projects.

Native compatibility boundaries remain applicable. Typed convenience APIs are complemented by generic native interop; synchronous native callbacks execute in the browser. Independent Razor roots do not automatically inherit outer cascading values.
