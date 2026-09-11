using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace RibbonWeb;

/// <summary>A data-only ribbon notification. No control/model graph crosses interop.</summary>
public sealed class RibbonEventArgs
{
    public string Type { get; set; } = string.Empty;
    public string Id { get; set; } = string.Empty;
    public JsonElement? Value { get; set; }
    public JsonElement? Parameter { get; set; }
}

/// <summary>
/// Host wrapper for the RibbonWeb JavaScript interop module.
/// The caller owns the supplied DotNetObjectReference and disposes it after this bridge.
/// </summary>
public sealed class RibbonWebInterop : IAsyncDisposable
{
    public const string DefaultModuleUrl = "_content/RibbonWeb.Blazor/index.js";
    private readonly IJSObjectReference _module;
    private readonly IJSObjectReference _bridge;
    private bool _disposed;

    private RibbonWebInterop(IJSObjectReference module, IJSObjectReference bridge)
    {
        _module = module;
        _bridge = bridge;
    }

    public static async ValueTask<RibbonWebInterop> ConnectAsync<T>(
        IJSRuntime js,
        ElementReference ribbon,
        DotNetObjectReference<T> receiver,
        string moduleUrl = DefaultModuleUrl,
        string methodName = "OnRibbonEvent") where T : class
    {
        if (string.IsNullOrWhiteSpace(moduleUrl)) throw new ArgumentException("A module URL is required.", nameof(moduleUrl));
        // Dynamic import requires an explicit relative prefix; keep the public
        // default compatible with the usual RCL _content/{PackageId}/ path.
        var importUrl = moduleUrl.StartsWith(".", StringComparison.Ordinal)
            || moduleUrl.StartsWith("/", StringComparison.Ordinal)
            || Uri.TryCreate(moduleUrl, UriKind.Absolute, out _)
            ? moduleUrl : "./" + moduleUrl;
        // Importing index.js also registers <ribbon-web> before the bridge is created.
        var module = await js.InvokeAsync<IJSObjectReference>("import", importUrl);
        try
        {
            var bridge = await module.InvokeAsync<IJSObjectReference>(
                "createDotNetBridge", ribbon, receiver, new { methodName });
            return new RibbonWebInterop(module, bridge);
        }
        catch
        {
            await module.DisposeAsync();
            throw;
        }
    }

    public ValueTask SetModelAsync(object model) => InvokeAsync("setModel", model);
    public ValueTask UpdateControlAsync(string id, object changes) => InvokeAsync("updateControl", id, changes);
    public ValueTask SetContextAsync(string name, bool active) => InvokeAsync("setContext", name, active);
    public ValueTask SelectTabAsync(string id) => InvokeAsync("selectTab", id);
    public ValueTask FlushAsync() => InvokeAsync("flush");

    private ValueTask InvokeAsync(string method, params object?[] args)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(RibbonWebInterop));
        return _bridge.InvokeVoidAsync(method, args);
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            await _bridge.InvokeVoidAsync("dispose");
            await _bridge.DisposeAsync();
            await _module.DisposeAsync();
        }
        catch (JSDisconnectedException)
        {
            // A disconnected Blazor Server circuit can no longer release browser objects.
        }
    }
}
