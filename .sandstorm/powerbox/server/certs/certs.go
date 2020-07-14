package certs

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
)

type KeyPair struct {
	Public, Private crypto.PublicKey
}

type CSR struct {
	template *x509.Certificate
	pubKey   crypto.PublicKey
}

type CA struct {
	key  *KeyPair
	cert *x509.Certificate
}

func GenCA() (CA, error) {
	key, err := GenKeyPair()
	if err != nil {
		return CA{}, err
	}
	cert := &x509.Certificate{
		// This doesn't really matter, but we have to fill it in with
		// something:
		SerialNumber: big.NewInt(12345),
	}
	data, err := x509.CreateCertificate(nil, cert, cert, key.Public, key.Private)
	if err != nil {
		return CA{}, err
	}
	cert, err = x509.ParseCertificate(data)
	return CA{
		key:  key,
		cert: cert,
	}, err
}

func (ca CA) RawCert() []byte {
	return ca.cert.Raw
}

func GenKeyPair() (*KeyPair, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	return &KeyPair{
		Private: key,
		Public:  key.Public(),
	}, nil
}

func (k KeyPair) GenCSR(hostName string) CSR {
	return CSR{
		template: &x509.Certificate{
			SerialNumber: big.NewInt(6789),
			Subject: pkix.Name{
				CommonName: hostName,
			},
		},
		pubKey: k.Public,
	}
}

func (ca CA) SignCSR(csr CSR) (*x509.Certificate, error) {
	data, err := x509.CreateCertificate(nil, csr.template, ca.cert, csr.pubKey, ca.key.Private)
	if err != nil {
		return nil, err
	}
	return x509.ParseCertificate(data)
}
