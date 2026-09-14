# Blazor publication and recovery

The pinned build source includes bounded NuGet download retries and 14 offline verifier tests. Component APIs, the canonical dotnet project, existing asset paths and published versions are unchanged.

After upload, public-payload verification waits up to 720 seconds. Missing downloads and transient network/rate-limit/server failures retry; permanent failures and downloaded payload conflicts remain fatal. NUGET_VERIFY_TIMEOUT_SECONDS or --timeout-seconds can override the budget; increase the workflow job timeout for a longer wait.

If upload succeeds but verification times out, rerun only the failed **publish** job in the original Actions run. Reuse its tested artifacts; never rebuild or replace an existing immutable version. Matching existing packages skip duplicate upload but still undergo complete payload comparison before release creation. Only NuGet's root repository signature is excluded, not assemblies, assets or the nuspec.

Version.props versions NuGet independently of npm. See [README.md](README.md) and [INTEGRATION.md](INTEGRATION.md) for hosting and build instructions.
