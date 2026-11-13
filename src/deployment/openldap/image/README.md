# OpenLDAP UBI 10.2 image

Container sources for the OpenLDAP peer used by RHDH LDAP / PQC e2e.

**Published image:** `quay.io/rhdh-test/security/openldap-ubi10.2:latest`

## Why this image exists

We need OpenLDAP on a base image that ships **OpenSSL 3.5.5+** (UBI 10.2). UBI does not package `openldap-servers`, and typical distro builds link TLS to NSS — so slapd is built **from source** with `--with-tls=openssl` against that OpenSSL.

## Files

| File                  | Role                                                   |
| --------------------- | ------------------------------------------------------ |
| `Containerfile`       | Multi-stage build: compile slapd, then runtime image   |
| `entrypoint.sh`       | Renders config, loads seed on first boot, starts slapd |
| `slapd.conf.template` | slapd config template (`__LDAP_*__` placeholders)      |
| `seed.ldif`           | Default tree: `dc=rhdh,dc=test`, users, groups         |

## Build and push

Run from this directory:

```bash
podman build -t quay.io/rhdh-test/security/openldap-ubi10.2:latest -f Containerfile .
podman push quay.io/rhdh-test/security/openldap-ubi10.2:latest
```

Optional: pin OpenLDAP version with `--build-arg OPENLDAP_VERSION=2.6.10`.

### Sanity checks after build

```bash
podman run --rm quay.io/rhdh-test/security/openldap-ubi10.2:latest openssl version
# expect OpenSSL 3.5.x

podman run --rm --entrypoint ldd quay.io/rhdh-test/security/openldap-ubi10.2:latest \
  /opt/openldap/libexec/slapd | grep -E 'libssl|libcrypto'
```

## Defaults

| Setting    | Value                                    |
| ---------- | ---------------------------------------- |
| Base DN    | `dc=rhdh,dc=test`                        |
| Admin      | `cn=admin,dc=rhdh,dc=test` / `user1pass` |
| LDAP port  | `1389`                                   |
| LDAPS port | `1636` (only if TLS enabled)             |
| TLS        | off (`LDAP_ENABLE_TLS=no`)               |
| User       | UID `1001` (OpenShift-friendly)          |

Seed users: `user1`, `user2`, `user3`, `rhdh-admin` (password `user1pass`).

## Environment variables

| Variable                 | Default            | Purpose                         |
| ------------------------ | ------------------ | ------------------------------- |
| `LDAP_ROOT`              | `dc=rhdh,dc=test`  | Directory suffix                |
| `LDAP_ADMIN_USERNAME`    | `admin`            | Root DN `cn=<user>,<root>`      |
| `LDAP_ADMIN_PASSWORD`    | `user1pass`        | Root password                   |
| `LDAP_PORT_NUMBER`       | `1389`             | Plain LDAP listen port          |
| `LDAP_LDAPS_PORT_NUMBER` | `1636`             | LDAPS listen port               |
| `LDAP_ENABLE_TLS`        | `no`               | `yes` / `true` to enable LDAPS  |
| `LDAP_SEED_FILE`         | `/ldifs/seed.ldif` | LDIF loaded once into empty MDB |
| `LDAP_TLS_CERT_FILE`     | `/certs/tls.crt`   | Server cert (TLS on)            |
| `LDAP_TLS_KEY_FILE`      | `/certs/tls.key`   | Server key (TLS on)             |
| `LDAP_TLS_CA_FILE`       | `/certs/ca.crt`    | CA file (TLS on)                |
