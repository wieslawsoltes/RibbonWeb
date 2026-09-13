# RibbonWeb.Blazor 0.2.0

Extend the existing RibbonWeb.Blazor package to .NET 8 and .NET 10 while preserving RibbonWeb, RibbonWebInterop, ICommand wiring and original static-asset paths. Add typed model definitions, native RibbonControl and complete generic browser-engine interop. Coordinate compatible-component initialization/disposal and expose Ready.

Include both components in functional WebAssembly and Interactive Server samples, with real package-consumer browser checks and independently versioned NuGet/release publication. Native synchronous callbacks and custom DOM factories stay in JavaScript; arbitrary Razor templates inside native shadow-DOM controls are not added.
