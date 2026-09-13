using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
namespace RibbonWeb.Blazor;

public abstract class RibbonOptions
{
    [JsonExtensionData] public Dictionary<string, object?>? AdditionalProperties { get; set; }
}
public sealed class RibbonDefinition : RibbonOptions
{
    public List<RibbonTabDefinition> Tabs { get; set; } = [];
    public List<RibbonItemDefinition> QuickAccessToolbar { get; set; } = [];
    public object? Backstage { get; set; }
    public string? SelectedTab { get; set; }
}
public sealed class RibbonTabDefinition : RibbonOptions
{
    public string Id { get; set; } = "";
    public string Header { get; set; } = "";
    public string? KeyTip { get; set; }
    public string? ContextualGroup { get; set; }
    public List<RibbonGroupDefinition> Groups { get; set; } = [];
}
public sealed class RibbonGroupDefinition : RibbonOptions
{
    public string Id { get; set; } = "";
    public string Header { get; set; } = "";
    public List<RibbonItemDefinition> Items { get; set; } = [];
    public object? Launcher { get; set; }
}
public sealed class RibbonItemDefinition : RibbonOptions
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "button";
    public string Label { get; set; } = "";
    public string? Icon { get; set; }
    public string? KeyTip { get; set; }
    public string? Tooltip { get; set; }
    public string Size { get; set; } = "medium";
    public bool Enabled { get; set; } = true;
    public bool Visible { get; set; } = true;
    public bool Checked { get; set; }
    public object? Value { get; set; }
    public object? Command { get; set; }
    public object? CommandParameter { get; set; }
    public object? Bindings { get; set; }
    public List<object> Items { get; set; } = [];
}
/// <summary>Native ribbon control with complete engine access. The existing RibbonWeb component retains ICommand compatibility.</summary>
public sealed class RibbonControl : BrowserComponent
{
    [Parameter, EditorRequired] public object Model { get; set; } = new RibbonDefinition();
    [Parameter] public long ModelVersion { get; set; }
    [Parameter] public object? DataContext { get; set; }
    [Parameter] public string Theme { get; set; } = "light";
    [Parameter] public string Layout { get; set; } = "classic";
    [Parameter] public bool Minimized { get; set; }
    protected override IReadOnlyList<string> DefaultEvents => ["dom:ribbon-command", "dom:ribbon-change", "dom:ribbon-tab-change", "dom:ribbon-context-change", "dom:ribbon-dotnet-error"];
    protected override Dictionary<string, object?> BuildOptions()
    {
        var options = base.BuildOptions(); options["model"] = Model; options["modelVersion"] = ModelVersion;
        options["dataContext"] = DataContext; options["theme"] = Theme; options["layout"] = Layout; options["minimized"] = Minimized; return options;
    }
    public ValueTask<bool> SelectTabAsync(string id) => InvokeAsync<bool>("selectTab", id);
    public ValueTask UpdateControlAsync(string id, object changes) => InvokeVoidAsync("updateControl", id, changes);
    public ValueTask<IJSObjectReference> GetControlAsync(string id) => InvokeAsync<IJSObjectReference>("getControl", id);
    public ValueTask SetContextAsync(string name, bool active) => InvokeVoidAsync("setContext", name, active);
    public ValueTask InvalidateAsync() => InvokeVoidAsync("invalidate");
}
public sealed class RibbonModule(IJSRuntime js) : BrowserModule(js);
