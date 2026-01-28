import { defineConfig } from "vitepress";

export default defineConfig({
  title: "RHDH E2E Test Utils",
  description:
    "Comprehensive test utilities for Red Hat Developer Hub end-to-end testing with Playwright",
  base: "/rhdh-e2e-test-utils/",

  head: [
    ["meta", { name: "theme-color", content: "#ee0000" }],
    [
      "meta",
      {
        name: "og:title",
        content: "RHDH E2E Test Utils Documentation",
      },
    ],
    [
      "meta",
      {
        name: "og:description",
        content:
          "Test utilities for Red Hat Developer Hub E2E testing with Playwright",
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API Reference", link: "/api/" },
      { text: "Tutorials", link: "/tutorials/" },
      { text: "Examples", link: "/examples/" },
      { text: "Overlay Testing", link: "/overlay/" },
      {
        text: "v1.1.6",
        items: [{ text: "Changelog", link: "/changelog" }],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
            { text: "Requirements", link: "/guide/requirements" },
          ],
        },
        {
          text: "Core Concepts",
          collapsed: false,
          items: [
            { text: "Overview", link: "/guide/core-concepts/" },
            {
              text: "Architecture",
              link: "/guide/core-concepts/architecture",
            },
            {
              text: "Package Exports",
              link: "/guide/core-concepts/package-exports",
            },
            {
              text: "Playwright Fixtures",
              link: "/guide/core-concepts/playwright-fixtures",
            },
            {
              text: "Playwright Configuration",
              link: "/guide/core-concepts/playwright-config",
            },
            { text: "Global Setup", link: "/guide/core-concepts/global-setup" },
            {
              text: "Testing Patterns",
              link: "/guide/core-concepts/testing-patterns",
            },
            {
              text: "Error Handling",
              link: "/guide/core-concepts/error-handling",
            },
          ],
        },
        {
          text: "Deployment",
          collapsed: false,
          items: [
            { text: "Overview", link: "/guide/deployment/" },
            {
              text: "RHDH Deployment",
              link: "/guide/deployment/rhdh-deployment",
            },
            {
              text: "Keycloak Deployment",
              link: "/guide/deployment/keycloak-deployment",
            },
            {
              text: "Helm Deployment",
              link: "/guide/deployment/helm-deployment",
            },
            {
              text: "Operator Deployment",
              link: "/guide/deployment/operator-deployment",
            },
            {
              text: "Authentication Providers",
              link: "/guide/deployment/authentication",
            },
          ],
        },
        {
          text: "Helpers",
          collapsed: true,
          items: [
            { text: "Overview", link: "/guide/helpers/" },
            { text: "UIhelper", link: "/guide/helpers/ui-helper" },
            { text: "LoginHelper", link: "/guide/helpers/login-helper" },
            { text: "APIHelper", link: "/guide/helpers/api-helper" },
          ],
        },
        {
          text: "Page Objects",
          collapsed: true,
          items: [
            { text: "Overview", link: "/guide/page-objects/" },
            { text: "CatalogPage", link: "/guide/page-objects/catalog-page" },
            { text: "HomePage", link: "/guide/page-objects/home-page" },
            {
              text: "CatalogImportPage",
              link: "/guide/page-objects/catalog-import-page",
            },
            {
              text: "ExtensionsPage",
              link: "/guide/page-objects/extensions-page",
            },
            {
              text: "NotificationPage",
              link: "/guide/page-objects/notification-page",
            },
          ],
        },
        {
          text: "Utilities",
          collapsed: true,
          items: [
            { text: "Overview", link: "/guide/utilities/" },
            {
              text: "Kubernetes Client",
              link: "/guide/utilities/kubernetes-client",
            },
            { text: "Bash Utilities", link: "/guide/utilities/bash-utilities" },
            { text: "YAML Merging", link: "/guide/utilities/yaml-merging" },
            {
              text: "Environment Substitution",
              link: "/guide/utilities/environment-substitution",
            },
            {
              text: "Plugin Metadata",
              link: "/guide/utilities/plugin-metadata",
            },
          ],
        },
        {
          text: "Configuration",
          collapsed: true,
          items: [
            { text: "Overview", link: "/guide/configuration/" },
            {
              text: "Configuration Files",
              link: "/guide/configuration/config-files",
            },
            {
              text: "ESLint Configuration",
              link: "/guide/configuration/eslint-config",
            },
            {
              text: "TypeScript Configuration",
              link: "/guide/configuration/typescript-config",
            },
            {
              text: "Environment Variables",
              link: "/guide/configuration/environment-variables",
            },
          ],
        },
      ],

      "/api/": [
        {
          text: "API Reference",
          items: [{ text: "Overview", link: "/api/" }],
        },
        {
          text: "Deployment",
          collapsed: false,
          items: [
            { text: "RHDHDeployment", link: "/api/deployment/rhdh-deployment" },
            {
              text: "Deployment Types",
              link: "/api/deployment/deployment-types",
            },
            { text: "KeycloakHelper", link: "/api/deployment/keycloak-helper" },
            { text: "Keycloak Types", link: "/api/deployment/keycloak-types" },
          ],
        },
        {
          text: "Playwright",
          collapsed: false,
          items: [
            { text: "Test Fixtures", link: "/api/playwright/test-fixtures" },
            { text: "Base Config", link: "/api/playwright/base-config" },
            { text: "Global Setup", link: "/api/playwright/global-setup" },
          ],
        },
        {
          text: "Helpers",
          collapsed: true,
          items: [
            { text: "UIhelper", link: "/api/helpers/ui-helper" },
            { text: "LoginHelper", link: "/api/helpers/login-helper" },
            { text: "APIHelper", link: "/api/helpers/api-helper" },
          ],
        },
        {
          text: "Page Objects",
          collapsed: true,
          items: [
            { text: "CatalogPage", link: "/api/pages/catalog-page" },
            { text: "HomePage", link: "/api/pages/home-page" },
            {
              text: "CatalogImportPage",
              link: "/api/pages/catalog-import-page",
            },
            { text: "ExtensionsPage", link: "/api/pages/extensions-page" },
            {
              text: "NotificationPage",
              link: "/api/pages/notification-page",
            },
          ],
        },
        {
          text: "Utilities",
          collapsed: true,
          items: [
            {
              text: "KubernetesClientHelper",
              link: "/api/utils/kubernetes-client",
            },
            { text: "Bash ($)", link: "/api/utils/bash" },
            { text: "YAML Merging", link: "/api/utils/merge-yamls" },
            { text: "envsubst", link: "/api/utils/common" },
            { text: "Plugin Metadata", link: "/api/utils/plugin-metadata" },
          ],
        },
        {
          text: "ESLint",
          collapsed: true,
          items: [
            {
              text: "createEslintConfig",
              link: "/api/eslint/create-eslint-config",
            },
          ],
        },
      ],

      "/tutorials/": [
        {
          text: "Tutorials",
          items: [
            { text: "Overview", link: "/tutorials/" },
            { text: "Your First Test", link: "/tutorials/first-test" },
            { text: "Testing a Plugin", link: "/tutorials/plugin-testing" },
            {
              text: "Multi-Project Setup",
              link: "/tutorials/multi-project-setup",
            },
            { text: "CI/CD Integration", link: "/tutorials/ci-cd-integration" },
            {
              text: "Keycloak OIDC Testing",
              link: "/tutorials/keycloak-oidc-testing",
            },
            {
              text: "Custom Page Objects",
              link: "/tutorials/custom-page-objects",
            },
          ],
        },
      ],

      "/examples/": [
        {
          text: "Examples",
          items: [
            { text: "Overview", link: "/examples/" },
            { text: "Basic Test", link: "/examples/basic-test" },
            { text: "Guest Authentication", link: "/examples/guest-auth-test" },
            {
              text: "Keycloak Authentication",
              link: "/examples/keycloak-auth-test",
            },
            {
              text: "Catalog Operations",
              link: "/examples/catalog-operations",
            },
            { text: "API Operations", link: "/examples/api-operations" },
            { text: "Custom Deployment", link: "/examples/custom-deployment" },
            { text: "Serial Tests", link: "/examples/serial-tests" },
          ],
        },
      ],

      "/overlay/": [
        {
          text: "Overlay Testing",
          items: [
            { text: "Overview", link: "/overlay/" },
            { text: "Getting Started", link: "/overlay/getting-started" },
            {
              text: "Repository Structure",
              link: "/overlay/repository-structure",
            },
          ],
        },
        {
          text: "Test Structure",
          collapsed: false,
          items: [
            {
              text: "Directory Layout",
              link: "/overlay/test-structure/directory-layout",
            },
            {
              text: "Configuration Files",
              link: "/overlay/test-structure/configuration-files",
            },
            { text: "Spec Files", link: "/overlay/test-structure/spec-files" },
          ],
        },
        {
          text: "Tutorials",
          collapsed: false,
          items: [
            {
              text: "Adding Tests to New Workspace",
              link: "/overlay/tutorials/new-workspace",
            },
            {
              text: "Plugin Configuration",
              link: "/overlay/tutorials/plugin-config",
            },
            {
              text: "Pre-requisite Services",
              link: "/overlay/tutorials/custom-deployment",
            },
            {
              text: "Running Tests Locally",
              link: "/overlay/tutorials/running-locally",
            },
            { text: "CI/CD Pipeline", link: "/overlay/tutorials/ci-pipeline" },
          ],
        },
        {
          text: "Examples",
          collapsed: false,
          items: [
            {
              text: "Tech Radar Plugin",
              link: "/overlay/examples/tech-radar",
            },
            {
              text: "Basic Plugin Test",
              link: "/overlay/examples/basic-plugin",
            },
          ],
        },
        {
          text: "Reference",
          collapsed: true,
          items: [
            {
              text: "Environment Variables",
              link: "/overlay/reference/environment-variables",
            },
            {
              text: "Package.json Scripts",
              link: "/overlay/reference/scripts",
            },
            { text: "Common Patterns", link: "/overlay/reference/patterns" },
            {
              text: "Troubleshooting",
              link: "/overlay/reference/troubleshooting",
            },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/redhat-developer/rhdh-e2e-test-utils",
      },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "Copyright Red Hat Developer Hub",
    },

    editLink: {
      pattern:
        "https://github.com/redhat-developer/rhdh-e2e-test-utils/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    lastUpdated: {
      text: "Updated at",
      formatOptions: {
        dateStyle: "full",
        timeStyle: "medium",
      },
    },

    outline: {
      level: [2, 3],
    },
  },

  markdown: {
    lineNumbers: true,
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
});
