{
  description = "Twitchbot";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nix-vite-plus.url = "github:ryoppippi/nix-vite-plus";
  };

  outputs =
    inputs@{ flake-parts, nix-vite-plus, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.treefmt-nix.flakeModule ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      perSystem =
        { pkgs, system, ... }:
        let
          node_ver = pkgs.nodejs_24;
        in
        {
          # Per-system attributes can be defined here. The self' and inputs'
          # module parameters provide easy access to attributes of the same
          # system.
          treefmt = {
            projectRootFile = "flake.nix";
            programs = {
              nixfmt.enable = true;
              deadnix.enable = true;
              statix.enable = true;
            };
          };
          packages.default = pkgs.callPackage ./package.nix {
            inherit (nix-vite-plus.packages.${system}) vp;
          };
          devShells.default = pkgs.mkShell {
            buildInputs = with pkgs; [
              node_ver
              nil
              pnpm
              nixfmt
              nix-vite-plus.packages.${system}.vp
            ];
          };
        };
    };
}
