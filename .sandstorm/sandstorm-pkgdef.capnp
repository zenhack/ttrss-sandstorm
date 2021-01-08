@0xa5c47f042b0bde78;

using Spk = import "/sandstorm/package.capnp";
# This imports:
#   $SANDSTORM_HOME/latest/usr/include/sandstorm/package.capnp
# Check out that file to see the full, documented package definition format.

const pkgdef :Spk.PackageDefinition = (
  # The package definition. Note that the spk tool looks specifically for the
  # "pkgdef" constant.

  id = "zj20q6pwy456cmq0k57n1mtqqtky664dfqnhsmf3t36khch5geph",
  # Your app ID is actually its public key. The private key was placed in
  # your keyring. All updates must be signed with the same key.

  manifest = (
    # This manifest is included in your app package to tell Sandstorm
    # about your app.
    appTitle = (defaultText = "Tiny Tiny RSS"),

    appVersion = 19,  # Increment this for every release.

    # This is stored in a text file that ttrss itself reads the version
    # from; we use `embed` to avoid duplication here.
    appMarketingVersion = (defaultText = embed "rootfs/opt/app/version_static.txt"),

    actions = [
      # Define your "new document" handlers here.
      ( title = (defaultText = "New TinyTinyRss"),
        nounPhrase = (defaultText = "RSS reader"),
        command = .myCommand
        # The command to run when starting for the first time. (".myCommand"
        # is just a constant defined at the bottom of the file.)
      )
    ],

    continueCommand = .myCommand,
    # This is the command called to start your app back up after it has been
    # shut down for inactivity. Here we're using the same command as for
    # starting a new instance, but you could use different commands for each
    # case.

    metadata = (
      icons = (
        appGrid = (png = (
          dpi1x = embed "app-graphics/tinytinyrss-128.png",
          dpi2x = embed "app-graphics/tinytinyrss-256.png"
        )),
        grain = (png = (
          dpi1x = embed "app-graphics/tinytinyrss-24.png",
          dpi2x = embed "app-graphics/tinytinyrss-48.png"
        )),
        market = (png = (
          dpi1x = embed "app-graphics/tinytinyrss-150.png",
          dpi2x = embed "app-graphics/tinytinyrss-300.png"
        )),
      ),

      website = "https://tt-rss.org",
      codeUrl = "https://github.com/zenhack/ttrss-sandstorm",
      license = (openSource = gpl3),
      categories = [media],

      author = (
        contactEmail = "ian@zenhack.net",
        pgpSignature = embed "pgp-signature",
        upstreamAuthor = "TinyTinyRSS Team",
      ),
      pgpKeyring = embed "pgp-keyring",

      description = (defaultText = embed "description.md"),
      shortDescription = (defaultText = "Feed reader"),

      screenshots = [
        (width = 448, height = 350, png = embed "sandstorm-screenshot.png")
      ],
    ),
  ),

  sourceMap = (
    # Here we defined where to look for files to copy into your package. The
    # `spk dev` command actually figures out what files your app needs
    # automatically by running it on a FUSE filesystem. So, the mappings
    # here are only to tell it where to find files that the app wants.
    searchPath = [
      ( sourcePath = "rootfs" ),
      (
        sourcePath = ".",
        hidePaths = [".git"],
      ),
      ( sourcePath = "/",    # Then search the system root directory.
        hidePaths = [ "opt/app/.git", "home", "proc", "sys",
                      "etc/passwd", "etc/hosts", "etc/host.conf",
                      "etc/nsswitch.conf", "etc/resolv.conf" ]
        # You probably don't want the app pulling files from these places,
        # so we hide them. Note that /dev, /var, and /tmp are implicitly
        # hidden because Sandstorm itself provides them.
      )
    ]
  ),

  fileList = "sandstorm-files.list",
  # `spk dev` will write a list of all the files your app uses to this file.
  # You should review it later, before shipping your app.

  alwaysInclude = [
    "opt/app",
    "usr/share/zoneinfo",
  ],

  bridgeConfig = (
    expectAppHooks = true
  )
);

const myCommand :Spk.Manifest.Command = (
  # Here we define the command used to start up your server.
  argv = ["/sandstorm-http-bridge", "8000", "--", "/bin/bash", "/opt/app/.sandstorm/launcher.sh"],
  environ = [
    # Note that this defines the *entire* environment seen by your app.
    (key = "PATH", value = "/usr/local/bin:/usr/bin:/bin"),
    (key = "SANDSTORM", value = "1"),
    # Export SANDSTORM=1 into the environment, so that apps running within Sandstorm
    # can detect if $SANDSTORM="1" at runtime, switching UI and/or backend to use
    # the app's Sandstorm-specific integration code.

    (key = "POWERBOX_WEBSOCKET_PORT", value = "3000"),
    (key = "POWERBOX_PROXY_PORT", value = "4000"),

    (key = "MYSQL_USER", value = "root"),
    (key = "MYSQL_DATABASE", value = "app"),
  ]
);
