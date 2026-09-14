# RibbonWeb.Blazor 0.2.1

Updates the pinned interop runtime to the tested Dockyard revision `1c895b7184451071e1c7131063249d2d9eb145b9`, with no Dockyard runtime dependency.

- Preserve cyclic/deep native argument graphs and shared callback identity without mutating inputs.
- Await concurrent native/module/subscription cleanup and asynchronous unsubscribe, continuing teardown after individual failures.
- Preserve property, method and disposal access through callable handles.
- Honor initialization-wait cancellation independently for each caller; prevent late native construction after disposal.
- Add complete streamed callable results through `CallFunctionJsonAsync<T>` and expanded JavaScript/managed regressions.

The compatible RibbonWeb component, RibbonWebInterop, ICommand integration, typed RibbonControl, real Razor custom controls and original static asset paths are preserved. Both .NET 8/.NET 10 WebAssembly and Interactive Server package consumers must pass validation before publication. Public NuGet payloads are verified before release creation.
