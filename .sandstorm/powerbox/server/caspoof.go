package main

import (
	"crypto/tls"

	"zenhack.net/go/ttrss-powerbox/server/certs"
)

type CertSpoofer struct {
	ca      certs.CA
	leafKey *certs.KeyPair
}

func GenSpoofer() (*CertSpoofer, error) {
	ca, err := certs.GenCA()
	if err != nil {
		return nil, err
	}
	leafKey, err := certs.GenKeyPair()
	return &CertSpoofer{
		ca:      ca,
		leafKey: leafKey,
	}, err
}

func (s *CertSpoofer) RawCACert() []byte {
	return s.ca.RawCert()
}

func (s *CertSpoofer) SpoofHost(hostName string) (tls.Certificate, error) {
	leafCert, err := s.ca.SignCSR(s.leafKey.GenCSR(hostName))
	if err != nil {
		return tls.Certificate{}, err
	}
	return tls.Certificate{
		Certificate: [][]byte{
			leafCert.Raw,
			s.ca.RawCert(),
		},
		PrivateKey: s.leafKey.Private,
		Leaf:       leafCert,
	}, nil
}

func (s *CertSpoofer) TLSConfig(hostName string) (*tls.Config, error) {
	cert, err := s.SpoofHost(hostName)
	if err != nil {
		return nil, err
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
	}, nil
}
