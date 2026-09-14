# RibbonWeb.Blazor 0.2.2

Adopts shared runtime c833be49d472583b6f56225862e0aa7d201c1da7, validated and merged through Dockyard PR #5. Fixes concurrent visual disposal, late Razor module imports and root creation, queued callbacks after removal, and repeated cleanup failures. Adds lifecycle state, awaitable factory teardown and coalesced template updates.

Preserves RibbonControl, typed definitions, real Razor custom controls and the compatible RibbonWeb/ICommand APIs and asset paths. The canonical project remains dotnet/RibbonWeb.Blazor.csproj. Both READMEs identify the new version.

.NET 8/.NET 10 actual-package WebAssembly/Interactive Server tests include template movement/update/recreation, managed disposal races, native interactions and compatible event forwarding. Eight new shared JavaScript lifecycle cases accompany existing checks. Publication validates public NuGet bytes before creating packages, symbols and runnable-sample releases. Native callback and engine compatibility boundaries remain unchanged.
